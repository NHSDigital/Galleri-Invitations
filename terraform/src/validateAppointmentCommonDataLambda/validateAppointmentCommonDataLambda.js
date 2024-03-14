import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const dbClient = new DynamoDBClient({
  region: "eu-west-2",
  convertEmptyValues: true,
});
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const appointmentString = await readFromS3(bucket, key, s3);
    const appointmentJson = JSON.parse(appointmentString);
    //AC1
    if (
      appointmentJson.hasOwnProperty("ParticipantID") &&
      appointmentJson.ParticipantID.trim() !== " "
    ) {
      const validateParticipantIdResponse = await lookUp(
        dbClient,
        appointmentJson.ParticipantID,
        "Population",
        "PersonId",
        "S",
        false
      );
      const validateEpisodeResponse = await lookUp(
        dbClient,
        appointmentJson.ParticipantID,
        "Episode",
        "Participant_Id",
        "S",
        true
      );
      const validateParticipantId = !(validateParticipantIdResponse.Items > 0);
      const validateEpisode = !(validateEpisodeResponse.Items > 0);

      if (validateParticipantId || validateEpisode) {
        await rejectRecord(appointmentJson);
      }
    } else {
      await rejectRecord(appointmentJson);
    }
    //AC2
    if (
      appointmentJson.hasOwnProperty("InvitationNHSNumber") &&
      appointmentJson.InvitationNHSNumber.trim() !== " " &&
      appointmentJson.hasOwnProperty("PDSNHSNumber") &&
      appointmentJson.PDSNHSNumber.trim() !== " "
    ) {
      if (
        appointmentJson.InvitationNHSNumber !==
          validateParticipantIdResponse.Items.nhs_number &&
        appointmentJson.PDSNHSNumber !==
          validateParticipantIdResponse.Items.nhs_number
      ) {
        await rejectRecord(appointmentJson);
      }
    } else {
      await rejectRecord(appointmentJson);
    }
    //AC3
    if (
      appointmentJson.hasOwnProperty("ClinicID") &&
      appointmentJson.ClinicID.trim() !== " "
    ) {
      const validateClinicIdResponse = await lookUp(
        dbClient,
        appointmentJson.ClinicID,
        "PhlebotomySite",
        "ClinicId",
        "S",
        false
      );
      const validateClinicId = !(validateClinicIdResponse.Items > 0);
      if (validateClinicId) {
        await rejectRecord(appointmentJson);
      }
    } else {
      await rejectRecord(appointmentJson);
    }
    //AC4
    if (
      appointmentJson.hasOwnProperty("AppointmentID") &&
      appointmentJson.AppointmentID.trim() !== " "
    ) {
      const validateAppointmentIdResponse = await lookUp(
        dbClient,
        appointmentJson.AppointmentID,
        "Appointments",
        "Appointment_Id",
        "S",
        true
      );
      const validateAppointmentId = validateAppointmentIdResponse.Items > 0;
      if (validateAppointmentId) {
        const oldAppointmentTime = new Date(
          validateAppointmentIdResponse.Items.AppointmentDateTime
        );
        const newAppointmentTime = new Date(
          appointmentJson.AppointmentDateTime
        );
        if (oldAppointmentTime > newAppointmentTime) {
          await rejectRecord(appointmentJson);
        }
      } else {
        await rejectRecord(appointmentJson);
      }
    } else {
      await rejectRecord(appointmentJson);
    }
  } catch (error) {
    console.error(
      "Error with Appointment extraction, procession or uploading",
      error
    );
  }
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
