//IMPORTS
import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object

  const cancelledByNHS = {
    CLINIC_CLOSED_DUE_TO_LACK_OF_STAFF: "CLINIC_CLOSED_DUE_TO_LACK_OF_STAFF",
    CLINIC_CLOSED_DUE_TO_LACK_OF_FACILITY:
      "CLINIC_CLOSED_DUE_TO_LACK_OF_FACILITY",
    CLINIC_CLOSED_DUE_TO_OTHER_REASON: "CLINIC_CLOSED_DUE_TO_OTHER_REASON",
  };

  const cancelledByParticipant = {
    CANT_FIND_A_SUITABLE_LOCATION: "CANT_FIND_A_SUITABLE_LOCATION",
    CANT_FIND_A_SUITABLE_DATE_TIME: "CANT_FIND_A_SUITABLE_DATE_TIME",
    WORK_FAMILY_COMMITMENTS: "WORK_FAMILY_COMMITMENTS",
    OTHER: "OTHER",
  };

  const participantWithdrawn = {
    NO_LONGER_LIVE_IN_THE_COUNTRY: "NO_LONGER_LIVE_IN_THE_COUNTRY",
    DONT_WANT_TO_TAKE_PART: "DONT_WANT_TO_TAKE_PART",
  };

  const ParticipantID = js?.["Appointment"]?.["ParticipantID"];
  const AppointmentID = js?.["Appointment"]?.["AppointmentID"];
  const CancellationReason = js?.["Appointment"]?.["CancellationReason"];
  const EventType = js?.["Appointment"]?.["EventType"]; //CANCELLED
  const Timestamp = js?.["Appointment"]?.["Timestamp"];

  const episodeResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Episode",
    "Participant_Id",
    "S",
    true
  );

  const episodeItems = episodeResponse.Items?.[0];
  console.log(
    `episodeItems for participant: ${JSON.stringify(episodeItems?.Participant_Id)} loaded.`
  );

  const appointmentResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Appointments",
    "Participant_Id",
    "S",
    false
  );
  // Get latest appointment for participant
  let appointmentItems;
  if (appointmentResponse.Items?.length) {
    const sortedAppointments = sortBy(appointmentResponse.Items, "Time_stamp", "S", false);
    appointmentItems = sortedAppointments[0];
  }
  console.log(
    `appointmentItems for appointment: ${JSON.stringify(appointmentItems?.Appointment_Id)} loaded.`
  );

  const dateTime = new Date(Date.now()).toISOString();

  if (episodeItems && appointmentItems && EventType === "CANCELLED") {
    //if both queries are not undefined
    if (appointmentItems.Appointment_Id.S !== AppointmentID ||
      appointmentItems.Time_stamp.S > Timestamp) {
      console.error("Error: Cancelled appointment does not match or the timestamp is earlier",
      " than latest participant appointment");
        const confirmation = await pushCsvToS3(
          `${bucket}`,
          `not_latest_participant_appointment/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        );
        return confirmation;
    }

    if (CancellationReason) {
      //cancellation reason is supplied
      console.log("The Supplied Reason Is: ");
      if (Object.values(cancelledByNHS).includes(CancellationReason)) {
        const episodeEvent = "Appointment Cancelled By NHS";
        console.log(episodeEvent);
        await transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems["Batch_Id"]["S"], //required PK for Episode update
          AppointmentID,
          EventType,
          Timestamp,
          episodeEvent, //Appointment Cancelled by NHS
          CancellationReason //reason its cancelled coming from payload
        );
      }
      if (Object.values(cancelledByParticipant).includes(CancellationReason)) {
        const episodeEvent = "Appointment Cancelled by participant";
        console.log(episodeEvent);
        await transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems["Batch_Id"]["S"],
          AppointmentID,
          EventType,
          Timestamp,
          episodeEvent,
          CancellationReason
        );
      }
      if (Object.values(participantWithdrawn).includes(CancellationReason)) {
        const episodeEvent =
          "Appointment Cancelled by Participant - No reminder";
        console.log(episodeEvent);
        await transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems["Batch_Id"]["S"],
          AppointmentID,
          EventType,
          Timestamp,
          episodeEvent,
          CancellationReason,
          "Closed"
        );
      }
      if (
        !Object.values(cancelledByNHS).includes(CancellationReason) &&
        !Object.values(cancelledByParticipant).includes(CancellationReason) &&
        !Object.values(participantWithdrawn).includes(CancellationReason)
      ) {
        //edge case, reason is populated but incorrect
        console.error("Error: Invalid cancellation reason for CANCELLED appointment");
        const confirmation = await pushCsvToS3(
          `${bucket}`,
          `invalid_cancellation_reason/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        );
        return confirmation;
      }
    } else {
      //Cancellation Reason not supplied
      console.error("Error: Cancellation reason not supplied for CANCELLED appointment");
      const confirmation = await pushCsvToS3(
        `${bucket}`,
        `cancellation_reason_not_provided/invalidRecord_${dateTime}.json`,
        csvString,
        s3
      );
      return confirmation;
    }
  } else {
    //Failed to match Appointments table, Episode table, or incorrect event type
    const confirmation = await pushCsvToS3(
      `${bucket}`,
      `record_does_not_match/invalidRecord_${dateTime}.json`,
      csvString,
      s3
    );
    return confirmation;
  }
};

//FUNCTIONS
export const sortBy = (items, key, keyType, asc = true) => {
  items.sort( (a,b) => {
    if (asc) {
      return (a[key][keyType] > b[key][keyType]) ? 1 :
        ((a[key][keyType] < b[key][keyType]) ? -1 : 0);
    } else {
      return (b[key][keyType] > a[key][keyType]) ? 1 :
        ((b[key][keyType] < a[key][keyType]) ? -1 : 0);
    }
  });
  return items;
};

export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return response.Body.transformToString();
  } catch (err) {
    console.error(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log(
      `Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

export const lookUp = async (dbClient, ...params) => {
  const [id, table, attribute, attributeType, useIndex] = params;

  const ExpressionAttributeValuesKey = `:${attribute}`;
  let expressionAttributeValuesObj = {};
  let expressionAttributeValuesNestObj = {};

  expressionAttributeValuesNestObj[attributeType] = id;
  expressionAttributeValuesObj[ExpressionAttributeValuesKey] =
    expressionAttributeValuesNestObj;

  const input = {
    ExpressionAttributeValues: expressionAttributeValuesObj,
    KeyConditionExpression: `${attribute} = :${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) {
    input.IndexName = `${attribute}-index`;
  }

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.$metadata.httpStatusCode != 200) {
    console.log(`look up item input = ${JSON.stringify(input, null, 2)}`);
  }

  return response;
};

export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  appointmentTimestamp,
  episodeEvent,
  cancellationReason,
  status = "Open"
) => {
  const timeNow = new Date(Date.now()).toISOString();
  const params = {
    TransactItems: [
      {
        Update: {
          Key: {
            Batch_Id: { S: batchId },
            Participant_Id: { S: participantId },
          },
          UpdateExpression: `SET Episode_Event = :episodeEvent, Episode_Event_Updated = :timeNow, Episode_Event_Description = :eventDescription, Episode_Status = :status, Episode_Event_Notes = :null, Episode_Event_Updated_By = :gtms, Episode_Status_Updated = :timeNow`,
          TableName: `${ENVIRONMENT}-Episode`,
          ExpressionAttributeValues: {
            ":episodeEvent": { S: episodeEvent },
            ":timeNow": { S: timeNow },
            ":eventDescription": { S: cancellationReason },
            ":status": { S: status },
            ":null": { S: "Null" },
            ":gtms": { S: "GTMS" },
          },
        },
      },
      {
        Update: {
          Key: {
            Participant_Id: { S: participantId },
            Appointment_Id: { S: appointmentId },
          },
          UpdateExpression: `SET event_type = :eventType, Time_stamp = :appointmentTimestamp, cancellation_reason = :cancellationReason`,
          TableName: `${ENVIRONMENT}-Appointments`,
          ExpressionAttributeValues: {
            ":eventType": { S: eventType },
            ":appointmentTimestamp": { S: appointmentTimestamp },
            ":cancellationReason": { S: cancellationReason },
          },
        },
      },
    ],
  };

  try {
    const command = new TransactWriteItemsCommand(params);
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(
        `Error occurred while trying to update db with item: ${participantId}`
      );
      return false;
    } else {
      console.log(`Successfully updated db with item: ${participantId}`);
      return true;
    }
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
};
