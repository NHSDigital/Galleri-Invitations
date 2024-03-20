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
    const { Appointment } = appointmentJson;
    //Check if ParticipantID and Episode exist in respective Dynamo tables
    if (Appointment.ParticipantID && Appointment.ParticipantID?.trim() !== "") {
      const validateParticipantIdResponse = await lookUp(
        dbClient,
        Appointment.ParticipantID,
        "Population",
        "PersonId",
        "S",
        false
      );
      const validateEpisodeResponse = await lookUp(
        dbClient,
        Appointment.ParticipantID,
        "Episode",
        "Participant_Id",
        "S",
        true
      );
      const validateParticipantId = !(
        validateParticipantIdResponse.Items.length > 0
      );
      const validateEpisode = !(validateEpisodeResponse.Items.length > 0);

      if (validateParticipantId || validateEpisode) {
        await rejectRecord(appointmentJson);
        console.log("No valid ParticipantID or Episode in table");
        return;
      }
    } else {
      await rejectRecord(appointmentJson);
      console.log("No property ParticipantID found");
      return;
    }
    //Check if either PDSNHSNumber and InvitationNHSNumber map to an NHS Number
    if (
      Appointment.InvitationNHSNumber &&
      Appointment.InvitationNHSNumber?.trim() !== "" &&
      Appointment.PDSNHSNumber &&
      Appointment.PDSNHSNumber?.trim() !== ""
    ) {
      if (
        Appointment.InvitationNHSNumber !==
          validateParticipantIdResponse.Items.nhs_number &&
        Appointment.PDSNHSNumber !==
          validateParticipantIdResponse.Items.nhs_number
      ) {
        await rejectRecord(appointmentJson);
        console.log(
          "InvitationNHSNumber nor PDSNHSNumber map to a valid NHSNumber"
        );
        return;
      }
    } else {
      await rejectRecord(appointmentJson);
      console.log("No property InvitationNHSNumber or PDSNHSNumber found");
      return;
    }
    //Check if ClinicID exists in its respective Dynamo tables
    if (Appointment.ClinicID && Appointment.ClinicID?.trim() !== "") {
      const validateClinicIdResponse = await lookUp(
        dbClient,
        Appointment.ClinicID,
        "PhlebotomySite",
        "ClinicId",
        "S",
        false
      );
      const validateClinicId = !(validateClinicIdResponse.Items.length > 0);
      if (validateClinicId) {
        await rejectRecord(appointmentJson);
        console.log("No valid ClinicID in table");
        return;
      }
    } else {
      await rejectRecord(appointmentJson);
      console.log("No property ClinicID found");
      return;
    }
    //Checks to ensure new appointment time is more recent than the old appointment time
    if (Appointment.AppointmentID && Appointment.AppointmentID?.trim() !== "") {
      const validateAppointmentIdResponse = await lookUp(
        dbClient,
        Appointment.AppointmentID,
        "Appointments",
        "Appointment_Id",
        "S",
        true
      );
      const validateAppointmentId =
        validateAppointmentIdResponse.Items.length > 0;
      if (validateAppointmentId) {
        const oldAppointmentTime = new Date(
          validateAppointmentIdResponse.Items.AppointmentDateTime
        );
        const newAppointmentTime = new Date(Appointment.AppointmentDateTime);
        if (oldAppointmentTime > newAppointmentTime) {
          await rejectRecord(appointmentJson);
          console.log(
            "Existing Appointment is more recent then New Appointment"
          );
          return;
        }
      } else {
        await rejectRecord(appointmentJson);
        console.log("No Valid Appointment found");
        return;
      }
    } else {
      await rejectRecord(appointmentJson);
      console.log("No property AppointmentID found");
      return;
    }
    await acceptRecord(appointmentJson, Appointment.EventType);
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

export const acceptRecord = async (appointmentJson, eventType) => {
  const timeNow = new Date().toISOString();
  const jsonString = JSON.stringify(appointmentJson);
  await pushToS3(
    `${ENVIRONMENT}-processed-appointments`,
    `validRecords/valid_records-${eventType}-${timeNow}.json`,
    jsonString,
    s3
  );
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
