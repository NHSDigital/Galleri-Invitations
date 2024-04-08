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

//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

// variables required for logging
const { timestamp, combine, printf, colorize, } = winston.format;
const myFormat = printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`);

//Need a lambda param for appointmentdatetime modifier

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object
  console.log(js);
  // logger.info(js);

  const payloadParticipantID = js?.['Appointment']?.['ParticipantID'];
  const payloadAppointmentID = js?.['Appointment']?.['AppointmentID'];
  const payloadEventType = js?.['Appointment']?.['EventType']; //BOOKED
  const payloadAppointmentDateTime = js?.['Appointment']?.['AppointmentDateTime'];

  const episodeResponse = await lookUp(dbClient, payloadParticipantID, "Episode", "Participant_Id", "S", true);
  const episodeItems = episodeResponse.Items[0];
  console.log(`episodeItems for participant: ${JSON.stringify(episodeItems)} loaded.`);
  // console.log(`episodeItems for participant: ${JSON.stringify(episodeItems.Participant_Id)} loaded.`);

  const appointmentResponse = await lookUp(dbClient, payloadAppointmentID, "Appointments", "Appointment_Id", "S", true);
  const appointmentItems = appointmentResponse.Items[0];
  console.log(`appointmentItems for appointment: ${JSON.stringify(appointmentItems)} loaded.`);
  // console.log(`appointmentItems for appointment: ${JSON.stringify(appointmentItems.Appointment_Id)} loaded.`);

  if (payloadAppointmentDateTime > (new Date()).toISOString()) {
    console.info(true);
  } else {
    console.info(false);
  }


  //if participant exists with no appt and apptID is supplied and is new + dateTime valid => add
  //if appointmentID supplied and does not exist in db and participant doesnt have exisitng appt and appointmentDatetime is not in past,
  // insert appointment record and update episode record
  // Episode Event = Appointment booked Letter
  // Episode Event updated = current system date timestamp
  // Episode event description = NULL
  // Episode event notes = NULL
  // Episode event updated by = GTMS
  // Episode status = Open
  // Episode status updated = same as episode event updated
  // Created timestamp
  // Updated timestamp


  //if appointmentDateTime is less than sys date + param (5 days):
  //   Episode Event = Appointment booked text
  // Episode Event updated = current system date timestamp
  // Episode event description = NULL
  // Episode event notes = NULL
  // Episode event updated by = GTMS
  // Episode status = Open
  // Episode status updated = same as episode event updated
  // Created timestamp
  // Updated timestamp


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
    console.error(`Failed to read from ${bucketName}/${key}`);
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
  episodeEvent,
  cancellationReason,
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
            ":eventDescription": { S: cancellationReason },
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
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error occurred while trying to update db with item: ${participantId}`);
      return false;
    } else {
      console.log(`Successfully updated db with item: ${participantId}`);
      return true;
    }
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
};

/**
 * This function aims to decouple parts of the logging process to make it more flexible and extensible.
 * It is used to configure a custom logger with things such as log levels,
 * timestamp, and colored text in your logs. The transport medium is the Console.
 */
export const logger = winston.createLogger({
  level: 'debug',
  format: combine(timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }), colorize({ all: true }), myFormat),
  transports: [
    new winston.transports.Console(),
  ],
});
