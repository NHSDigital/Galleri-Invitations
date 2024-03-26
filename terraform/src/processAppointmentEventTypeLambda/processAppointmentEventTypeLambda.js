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
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const appointmentString = await readFromS3(bucket, key, s3);
  const appointmentJson = JSON.parse(appointmentString);
  const { Appointment } = appointmentJson;
  const {
    ParticipantID,
    AppointmentID,
    BloodCollectionDate,
    GrailID,
    BloodNotCollectedReason,
    EventType,
  } = Appointment;
  const episodeResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Episode",
    "Participant_Id",
    "S",
    true
  );
  const episodeItems = episodeResponse.Items[0];
  const episodeEvent = {
    complete: "Appointment Attended - Sample Taken",
    no_show: "Did Not Attend Appointment",
    aborted: "Invalid Appointment: Blood not collected reason not supplied",
  };
  try {
    let response = false;

    switch (EventType) {
      case "COMPLETE":
        console.log(`This was a ${EventType}`);
        if (BloodCollectionDate && GrailID) {
          response = await transactionalWrite(
            dbClient,
            ParticipantID,
            episodeItems.Batch_Id.S,
            AppointmentID,
            EventType,
            episodeEvent.complete
          );
        } else {
          await rejectRecord(appointmentJson);
          console.log(
            "Invalid Appointment: Blood collection date and Grail ID not both supplied"
          );
        }
        break;

      case "NO_SHOW":
        console.log(`This was a ${EventType}`);
        response = await transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems.Batch_Id.S,
          AppointmentID,
          EventType,
          episodeEvent.no_show
        );
        break;

      case "ABORTED":
        console.log(`This was a ${EventType}`);
        if (BloodNotCollectedReason) {
          response = await transactionalWrite(
            dbClient,
            ParticipantID,
            episodeItems.Batch_Id.S,
            AppointmentID,
            EventType,
            episodeEvent.aborted,
            BloodNotCollectedReason
          );
        } else {
          await rejectRecord(appointmentJson);
          console.log(
            "Invalid Appointment: Blood not collected reason not supplied"
          );
        }
        break;

      default:
        await rejectRecord(appointmentJson);
        console.error(
          `This was a ${EventType}, which is not an expected Event Type`
        );
        break;
    }
    if (!response) {
      await rejectRecord(appointmentJson);
      console.log("Could not Update Episode and Appointment Table");
    }
  } catch (error) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${error}`;
    console.error(message);
    throw new Error(message);
  }
};

//METHODS
//S3 Methods
export const readFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    return response.Body.transformToString();
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const pushToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const rejectRecord = async (appointmentJson) => {
  try {
    const timeNow = new Date().toISOString();
    const jsonString = JSON.stringify(appointmentJson);
    await pushToS3(
      `${ENVIRONMENT}-processed-appointments`,
      `invalidRecords/invalid_records-${timeNow}.json`,
      jsonString,
      s3
    );
    return;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

//Dynamo Methods
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
// Updates Episode and appointment
export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  episodeEvent,
  eventDescription = "Null"
) => {
  const timeNow = String(Date.now());
  const params = {
    TransactItems: [
      {
        Update: {
          Key: {
            Batch_Id: { S: batchId },
            Participant_Id: { S: participantId },
          },
          UpdateExpression: `SET Episode_Event = :episodeEvent, Episode_Event_Updated = :timeNow, Episode_Event_Description = :eventDescription, Episode_Status = :open, Episode_Event_Notes = :null, Episode_Event_Updated_By = :gtms, Episode_Status_Updated = :timeNow`,
          TableName: `${ENVIRONMENT}-Episode`,
          ExpressionAttributeValues: {
            ":episodeEvent": { S: episodeEvent },
            ":timeNow": { N: timeNow },
            ":eventDescription": { S: eventDescription },
            ":open": { S: "Open" },
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
          UpdateExpression: `SET event_type = :eventType`,
          TableName: `${ENVIRONMENT}-Appointments`,
          ExpressionAttributeValues: {
            ":eventType": { S: eventType },
          },
        },
      },
    ],
  };

  try {
    const command = new TransactWriteItemsCommand(params);
    const response = await client.send(command);
    return true;
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
};
