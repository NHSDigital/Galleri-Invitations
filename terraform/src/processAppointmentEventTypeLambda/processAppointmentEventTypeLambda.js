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
    Timestamp,
  } = Appointment;

  // Appointment must match latest participant appointment
  const appointmentResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Appointments",
    "Participant_Id",
    "S",
    false
  );

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
    aborted: "Appointment Attended – No Sample Taken",
  };
  try {
    const numAppointments = appointmentResponse.Items?.length;
    if (!numAppointments) {
      await rejectRecord(appointmentJson);
      throw new Error("Invalid Appointment - no participant appointment found");
    }
    const sortedAppointments = sortBy(
      appointmentResponse.Items,
      "Time_stamp",
      "S",
      false
    );
    if (
      sortedAppointments[0].Appointment_Id.S !== AppointmentID ||
      sortedAppointments[0].Time_stamp.S > Timestamp
    ) {
      await rejectRecord(appointmentJson);
      throw new Error(
        "Invalid Appointment - does not match or timestamp is earlier" +
          " than latest participant appointment"
      );
    }

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
            Timestamp,
            episodeEvent.complete,
            "null",
            GrailID,
            BloodCollectionDate
          );
        } else {
          await rejectRecord(appointmentJson);
          console.error(
            "Error: Invalid Appointment - Blood collection date and Grail ID not both supplied for complete"
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
          Timestamp,
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
            Timestamp,
            episodeEvent.aborted,
            BloodNotCollectedReason
          );
        } else {
          await rejectRecord(appointmentJson);
          console.error(
            "Error: Invalid Appointment - Blood not collected reason not supplied for aborted"
          );
        }
        break;

      default:
        await rejectRecord(appointmentJson);
        console.error(
          `Error: This was a ${EventType}, which is not an expected Event Type`
        );
        break;
    }
    if (!response) {
      await rejectRecord(appointmentJson);
      console.error("Error: Could not Update Episode and Appointment Table");
    }
  } catch (error) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${error}`;
    console.error(message);
    throw new Error(message);
  }
};


/**
 * Reads a file from S3.
 *
 * @function readFromS3
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<string>}
 * @async
 */
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


/**
 * Pushes a file to S3.
 *
 * @function pushToS3
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {string} body - The content to be uploaded.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<Object>}
 * @async
 */
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

/**
 * Rejects a record and uploads it to S3.
 *
 * @function rejectRecord
 * @param {Object} appointmentJson - The appointment data.
 * @returns {Promise<void>}
 * @async
 */
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

/**
 * Looks up an item in DynamoDB.
 *
 * @function lookUp
 * @param {DynamoDBClient} dbClient - An instance of the DynamoDB client.
 * @param {...string} params - The parameters for the lookup.
 * @returns {Promise<Object>}
 * @async
 */
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

/**
 * Performs a transactional write to update Episode and Appointment tables in DynamoDB.
 *
 * @function transactionalWrite
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {string} participantId - The ID of the participant.
 * @param {string} batchId - The batch ID.
 * @param {string} appointmentId - The ID of the appointment.
 * @param {string} eventType - The event type.
 * @param {string} appointmentTimestamp - The timestamp of the appointment.
 * @param {string} episodeEvent - The episode event.
 * @param {string} [eventDescription="null"] - The event description.
 * @param {string} [grailId="null"] - The Grail ID.
 * @param {string} [bloodCollectionDate="null"] - The blood collection date.
 * @returns {Promise<boolean>} Resolves to true if the transaction is successful.
 * @async
 */
export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  appointmentTimestamp,
  episodeEvent,
  eventDescription = "null",
  grailId = "null",
  bloodCollectionDate = "null"
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
          UpdateExpression: `SET Episode_Event = :episodeEvent, Episode_Event_Updated = :timeNow, Episode_Event_Description = :eventDescription, Episode_Status = :open, Episode_Event_Notes = :null, Episode_Event_Updated_By = :gtms, Episode_Status_Updated = :timeNow`,
          TableName: `${ENVIRONMENT}-Episode`,
          ExpressionAttributeValues: {
            ":episodeEvent": { S: episodeEvent },
            ":timeNow": { S: timeNow },
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
          UpdateExpression: `SET event_type = :eventType, Time_stamp = :appointmentTimestamp, grail_id = :grailId, blood_collection_date = :bloodCollectionDate, blood_not_collected_reason = :bloodNotCollectedReason`,
          TableName: `${ENVIRONMENT}-Appointments`,
          ExpressionAttributeValues: {
            ":eventType": { S: eventType },
            ":appointmentTimestamp": { S: appointmentTimestamp },
            ":grailId": { S: grailId },
            ":bloodCollectionDate": { S: bloodCollectionDate },
            ":bloodNotCollectedReason": { S: eventDescription },
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
    console.error("Error: Transactional write failed:", error);
  }
};

/**
 * Sorts an array of items by a specified key.
 *
 * @function sortBy
 * @param {Array} items - The array of items to sort.
 * @param {string} key - The key to sort by.
 * @param {string} keyType - The type of the key.
 * @param {boolean} [asc=true] - Whether to sort in ascending order.
 * @returns {Array} The sorted array.
 */
export const sortBy = (items, key, keyType, asc = true) => {
  items.sort((a, b) => {
    if (asc) {
      return a[key][keyType] > b[key][keyType]
        ? 1
        : a[key][keyType] < b[key][keyType]
        ? -1
        : 0;
    } else {
      return b[key][keyType] > a[key][keyType]
        ? 1
        : b[key][keyType] < a[key][keyType]
        ? -1
        : 0;
    }
  });
  return items;
};
