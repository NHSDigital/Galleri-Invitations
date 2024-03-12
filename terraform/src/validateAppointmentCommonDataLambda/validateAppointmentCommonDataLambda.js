// PsuedoCode read object from S3 from appointment message validate s3
// check population table for participant_ID and episode table for matching entry.
// check the InvitationNHSNumber is supplied And PDSNHSNumber is supplied either matches a participant's NHSnumber
// check clinicID is supplied and it
// GIven UUID is has timestamp more recent than existing timestamp with same UUID

// "example": {
//   "ParticipantID": "NHS-AB12-CD34",
//   "AppointmentID": "00000000-0000-0000-0000-000000000000",
//   "ClinicID": "D7E-G2H",
//   "AppointmentDateTime": "2006-01-02T15:04:05.000Z",
//   "BloodCollectionDate": "2006-01-02",
//   "PrimaryPhoneNumber": "01999999999",
//   "SecondaryPhoneNumber": "01999999999",
//   "Email": "me@example.com",
//   "Replaces": null,
//   "CancellationReason": null,
//   "Channel": "ONLINE",
//   "BloodNotCollectedReason": null,
//   "EventType": "BOOKED",
//   "AppointmentAccessibility": {
//     "accessibleToilet": true,
//     "disabledParking": true,
//     "inductionLoop": true,
//     "signLanguage": true,
//     "stepFreeAccess": true,
//     "wheelchairAccess": true
//   },

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const dbClient = new DynamoDBClient({ region: "eu-west-2" });
const SUCCESSFUL_RESPONSE = 200;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const appointmentString = (readFromS3 = (bucket, key, s3));
    const appointmentJson = JSON.parse(appointmentString);

    if (
      appointmentJson.hasOwnProperty("ParticipantID") &&
      appointmentJson.ParticipantID.trim() !== " "
    ) {
      const validateParticipantId = await lookUp(
        dbClient,
        appointmentJson.ParticipantID,
        "Population",
        "participantId",
        "S",
        true
      );
      const validateEpisode = await lookUp(
        dbClient,
        appointmentJson.ParticipantID,
        "Episode",
        "participantId",
        "S",
        true
      );
    }
    if (validateParticipantId !== SUCCESSFUL_RESPONSE || validateEpisode !== SUCCESSFUL_RESPONSE) {
      await pushToS3(`${ENVIRONMENT}-processed-inbound-gtms-clinic-create-or-update`, `validRecords/valid_records_add-${timeNow}.json`, jsonString, s3);
      return;
    }
  }   catch (error) {
    console.error(
      "Error with appointment extraction, procession or uploading",
      error
    );
};

//METHODS
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

// DYNAMODB FUNCTIONS
// returns successful response if attribute doesn't exist in table
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

// returns item and metadata from dynamodb table
export const getItemFromTable = async (dbClient, table, ...keys) => {
  const [
    partitionKeyName,
    partitionKeyType,
    partitionKeyValue,
    sortKeyName,
    sortKeyType,
    sortKeyValue,
  ] = keys;

  let partitionKeyNameObject = {};
  let partitionKeyNameNestedObject = {};
  partitionKeyNameNestedObject[partitionKeyType] = partitionKeyValue;
  partitionKeyNameObject[partitionKeyName] = partitionKeyNameNestedObject;

  const keyObject = {
    key: partitionKeyNameObject,
  };

  if (sortKeyName !== undefined) {
    keyObject.key.sortKeyName = {
      sortKeyType: sortKeyValue,
    };
  }

  const params = {
    Key: partitionKeyNameObject,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  const command = new GetItemCommand(params);
  const response = await dbClient.send(command);
  return response;
};
