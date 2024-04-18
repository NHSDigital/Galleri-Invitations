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
import winston from "winston";
import dayjs from "dayjs";

//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

// variables required for logging
const { timestamp, combine, printf, } = winston.format;
const myFormat = printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`);

const DATEPARAM = process.env.DATEPARAM;

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object

  const payloadParticipantID = js?.['Appointment']?.['ParticipantID'];
  const payloadAppointmentID = js?.['Appointment']?.['AppointmentID'];
  const payloadEventType = js?.['Appointment']?.['EventType']; //BOOKED
  const payloadAppointmentDateTime = js?.['Appointment']?.['AppointmentDateTime'];
  const payloadAppointmentReplaces = js?.['Appointment']?.['Replaces']; //replaces existing appointment id
  const payloadTimestamp = dayjs(js?.['Timestamp']).format("YYYY-MM-DD"); //most recent

  const episodeResponse = await lookUp(dbClient, payloadParticipantID, "Episode", "Participant_Id", "S", true);
  const episodeItems = episodeResponse.Items[0];
  logger.info(`episodeItems for participant: ${JSON.stringify(episodeItems?.Participant_Id)} loaded.`);
  //doesnt pull associated appointment id as in scenario it is new but links to existing

  const appointmentResponse = await lookUp(dbClient, payloadAppointmentID, "Appointments", "Appointment_Id", "S", true);
  const appointmentItems = appointmentResponse.Items[0];
  logger.info(`appointmentItems for appointment: ${JSON.stringify(appointmentItems?.Appointment_Id)} loaded.`);
  //bring back most recent appointment, with timestamp

  const appointmentParticipant = await lookUp(dbClient, payloadParticipantID, "Appointments", "Participant_Id", "S", false); //Check participant has any appointments
  console.log('appointmentParticipant');
  console.log(JSON.stringify(appointmentParticipant));

  const apptArr = appointmentParticipant?.Items;
  const sortedApptParticipants = apptArr?.sort(function (x, y) {
    return new Date(x?.['Timestamp']?.['S']) < new Date(y?.['Timestamp']?.['S']) ? 1 : -1;
  });
  console.log('SortedApptParticipants');
  console.log(sortedApptParticipants);
  const appointmentParticipantItems = sortedApptParticipants[0];
  logger.info(`appointmentParticipantItems for appointment: ${JSON.stringify(appointmentParticipantItems)} loaded.`);
  // logger.info(`appointmentParticipantItems for appointment: ${JSON.stringify(appointmentParticipantItems?.Appointment_Id)} loaded.`);

  let date = new Date();
  console.log(date);
  const dateTime = new Date(Date.now()).toISOString();
  console.log(dateTime);
  try {
    if ((payloadAppointmentDateTime > date.toISOString()) && payloadEventType === 'BOOKED' && episodeItems) {
      console.info('Payload EventType is Booked and has a valid appointment date');
      if (!appointmentItems && payloadAppointmentID !== null && !appointmentParticipantItems) { // new appointment ID, and no existing = ADD
        console.info('Identified payload is for booked appointment');
        date.setDate(date.getDate() + DATEPARAM);
        if (payloadAppointmentDateTime > date.toISOString()) { //greater than date param, e.g. 5
          const episodeEvent = 'Appointment Booked Letter';
          logger.info(episodeEvent);
          await transactionalWrite(
            dbClient,
            payloadParticipantID,
            episodeItems['Batch_Id']['S'], //required PK for Episode update
            payloadAppointmentID,
            payloadEventType,
            episodeEvent,
            payloadTimestamp,
          );
        } else {
          const episodeEvent = 'Appointment Booked Text';
          logger.info(episodeEvent);
          await transactionalWrite(
            dbClient,
            payloadParticipantID,
            episodeItems['Batch_Id']['S'], //required PK for Episode update
            payloadAppointmentID,
            payloadEventType,
            episodeEvent,
            payloadTimestamp,
          );
        }
      } else if (!appointmentItems && appointmentParticipantItems && (payloadAppointmentReplaces === appointmentParticipantItems?.['Appointment_Id']?.['S'])) {  //same appointmentID = UPDATE
        console.info('Identified payload is for rebooked appointment');
        if (payloadAppointmentDateTime > date.toISOString()) { //greater than date param, e.g. 5
          const episodeEvent = 'Appointment Rebooked Letter';
          logger.info(episodeEvent);
          await transactionalWrite(
            dbClient,
            payloadParticipantID,
            episodeItems['Batch_Id']['S'], //required PK for Episode update
            payloadAppointmentID,
            payloadEventType,
            episodeEvent,
            payloadTimestamp,
          );
        } else {
          const episodeEvent = 'Appointment Rebooked Text';
          logger.info(episodeEvent);
          await transactionalWrite(
            dbClient,
            payloadParticipantID,
            episodeItems['Batch_Id']['S'], //required PK for Episode update
            payloadAppointmentID,
            payloadEventType,
            episodeEvent,
            payloadTimestamp,
          );
        }
      } else { // has appointment id and different one supplied, REJECT
        //REJECT
        logger.error('Error: payload invalid');
        const confirmation = await pushCsvToS3(
          `${bucket}`,
          `invalid_appointment_data/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        );
        return confirmation;
      }
    } else {
      logger.error('Error: payload invalid');
      //REJECT
      const confirmation = await pushCsvToS3(
        `${bucket}`,
        `invalid_booked_event/invalidRecord_${dateTime}.json`,
        csvString,
        s3
      );
      return confirmation;
    }
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    logger.error(message);
    throw new Error(message);
  }
};


//FUNCTIONS
/**
 * This function is used to retrieve an object from S3,
 * and allow the data retrieved to be used in your code.
 *
 * @param {string} bucketName The name of the bucket you are querying
 * @param {string} key The name of the object you are retrieving
 * @param {Object} client Instance of S3 client
 * @returns {Object} The data of the file you retrieved
 */
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
    console.error(`Error: Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

/**
 * This function is used to write a new object in S3
 *
 * @param {string} bucketName The name of the bucket you are pushing to
 * @param {string} key The name you want to give to the file you will write to S3
 * @param {string} body The data you will be writing to S3
 * @param {Object} client Instance of S3 client
 * @returns {Object} metadata about the request, including httpStatusCode
 */
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
    console.log(`Failed to push to ${bucketName}/${key}. Error Message: ${err}`);
    throw err;
  }
};

/**
 * This function allows the user to query against DynamoDB.
 *
 * @param {Object} dbClient Instance of DynamoDB client
 * @param  {...any} params params is destructed to id, which is the value you use to query against.
 * The table is the table name (type String), attribute is the column you search against (type String),
 * attributeType is the type of data stored within that column and useIndex is toggled to true if you want to use
 * an existing index (type boolean)
 * @returns {Object} metadata about the request, including httpStatusCode
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
 * This function is used to write to both episode and appointments table depending on the received payload
 *
 * @param {Object} client Instance of DynamoDB client
 * @param {string} participantId The id of the participant
 * @param {string} batchId The batch id attached to the episode record
 * @param {string} appointmentId The appointment id relating to the entry payload
 * @param {string} eventType The eventType extracted from the payload from GTMS
 * @param {string} episodeEvent Text which is added added to the episode record to signify the type of Episode event update
 * @returns {boolean} Returns either true of false depending on the success writing to 2 DynamoDB's
 */
export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  episodeEvent,
  timestamp,
) => {
  const timeNow = String(dayjs(new Date(Date.now()).toISOString()).format("YYYY-MM-DD"));
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
            ":eventDescription": { S: "NULL" },
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
          UpdateExpression: `SET event_type = :eventType, Time_stamp = :timestamp`,
          TableName: `${ENVIRONMENT}-Appointments`,
          ExpressionAttributeValues: {
            ":eventType": { S: eventType },
            ":timestamp": { S: timestamp },
          },
        },
      },
    ],
  };

  console.log(params);

  try {
    const command = new TransactWriteItemsCommand(params);
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error: occurred while trying to update db with item: ${participantId}`);
      return false;
    } else {
      console.log(`Successfully updated db with item: ${participantId}`);
      return true;
    }
  } catch (error) {
    console.error("Error: Transactional write failed:", error);
  }
};

/**
 * This function aims to decouple parts of the logging process to make it more flexible and extensible.
 * It is used to configure a custom logger with things such as log levels,
 * timestamp. The transport medium is the Console.
 */
export const logger = winston.createLogger({
  level: 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }), myFormat),
  transports: [
    new winston.transports.Console(),
  ],
});
