import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

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
    let validateParticipantIdResponse;
    const appointmentString = await readFromS3(bucket, key, s3);
    const appointmentJson = JSON.parse(appointmentString);
    const { Appointment } = appointmentJson;
    // Check if ParticipantID and Episode exist in respective Dynamo tables
    if (Appointment.ParticipantID && Appointment.ParticipantID?.trim() !== "") {
      validateParticipantIdResponse = await lookUp(
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
        await rejectRecord(
          appointmentJson,
          "No valid ParticipantID or Episode in table"
        );
        return;
      }
    } else {
      await rejectRecord(appointmentJson, "No property ParticipantID found");
      return;
    }
    // Check if either PDSNHSNumber and InvitationNHSNumber map to an NHS Number
    if (
      Appointment.InvitationNHSNumber &&
      Appointment.InvitationNHSNumber?.trim() !== "" &&
      Appointment.PDSNHSNumber &&
      Appointment.PDSNHSNumber?.trim() !== ""
    ) {
      if (
        validateParticipantIdResponse &&
        Appointment.InvitationNHSNumber !==
          validateParticipantIdResponse.Items[0].nhs_number.N &&
        Appointment.PDSNHSNumber !==
          validateParticipantIdResponse.Items[0].nhs_number.N
      ) {
        await rejectRecord(
          appointmentJson,
          "InvitationNHSNumber nor PDSNHSNumber map to a valid NHSNumber"
        );
        return;
      }
    } else {
      await rejectRecord(
        appointmentJson,
        "No property InvitationNHSNumber or PDSNHSNumber found"
      );
      return;
    }
    // Check if ClinicID exists in its respective Dynamo tables
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
        await rejectRecord(appointmentJson, "No valid ClinicID in table");
        return;
      }
    } else {
      await rejectRecord(appointmentJson, "No property ClinicID found");
      return;
    }
    // Checks to ensure new appointment time is more recent than the old appointment time
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
          validateAppointmentIdResponse.Items[0].Time_stamp.S
        );
        const newAppointmentTime = new Date(Appointment.Timestamp);
        if (oldAppointmentTime > newAppointmentTime) {
          await rejectRecord(
            appointmentJson,
            "Existing Appointment is more recent then New Appointment"
          );
          return;
        }
        if (
          Appointment.Replaces === null &&
          validateAppointmentIdResponse.Items[0].event_type.S ===
            Appointment.EventType
        ) {
          if (
            validateAppointmentIdResponse.Items[0].Appointment_Id.S ==
            Appointment.AppointmentID
          ) {
            await updateAppointmentTable(dbClient, Appointment);
          } else {
            await rejectRecord(
              appointmentJson,
              "Appointment ID do not match for update"
            );
            return;
          }
        }
      }
    } else {
      await rejectRecord(appointmentJson, "No property AppointmentID found");
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

/**
 * Reads a file from S3.
 *
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<string>}
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
    console.error("Error: ", err);
    throw err;
  }
};

/**
 * Pushes a file to S3.
 *
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {string} body - The content to be uploaded.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<Object>}
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
    console.error("Error: ", err);
    throw err;
  }
};

/**
 * Rejects a record and uploads it to S3.
 *
 * @param {Object} appointmentJson - The appointment data.
 * @param {string} msg - The rejection message.
 * @returns {Promise<void>}
 */
export const rejectRecord = async (appointmentJson, msg) => {
  try {
    const timeNow = new Date().toISOString();
    const jsonString = JSON.stringify(appointmentJson);
    const filename = `invalid_records-${timeNow}.json`;
    await pushToS3(
      `${ENVIRONMENT}-processed-appointments`,
      `invalidRecords/${filename}`,
      jsonString,
      s3
    );
    console.error(`Error: ${msg} \n Saving ${filename} to Invalid Records`);
    return;
  } catch (err) {
    console.error("Error: ", err);
    throw err;
  }
};

/**
 * Accepts a record and uploads it to S3.
 *
 * @param {Object} appointmentJson - The appointment data.
 * @param {string} eventType - The event type.
 * @returns {Promise<void>}
 */
export const acceptRecord = async (appointmentJson, eventType) => {
  const timeNow = new Date().toISOString();
  const jsonString = JSON.stringify(appointmentJson);
  const processedEventType =
    eventType === "BOOKED" || eventType === "CANCELLED"
      ? eventType
      : "COMPLETE";
  await pushToS3(
    `${ENVIRONMENT}-processed-appointments`,
    `validRecords/valid_records_${processedEventType}-${timeNow}.json`,
    jsonString,
    s3
  );
};

/**
 * Looks up an item in DynamoDB.
 *
 * @param {DynamoDBClient} dbClient - An instance of the DynamoDB client.
 * @param {...string} params - The parameters for the lookup.
 * @returns {Promise<Object>}
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
 * Updates the appointment table in DynamoDB.
 *
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {Object} appointment - The appointment data.
 * @param {string} [table=`${ENVIRONMENT}-Appointments`] - The name of the DynamoDB table.
 * @returns {Promise<number>} Resolves to the HTTP status code of the response.
 */
export async function updateAppointmentTable(
  client,
  appointment,
  table = `${ENVIRONMENT}-Appointments`
) {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = appointment.ParticipantID;
  const sortKeyName = "Appointment_Id";
  const sortKeyValue = appointment.AppointmentID;
  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: { S: partitionKeyValue },
      [sortKeyName]: { S: sortKeyValue },
    },
    UpdateExpression:
      "SET primary_phone_number = :primaryNumber, secondary_phone_number = :secondaryNumber, email_address = :email_address, appointment_accessibility = :appointmentAccessibility, communications_accessibility = :communicationsAccessibility, notification_preferences= :notificationPreferences, Time_stamp = :time_stamp",
    ExpressionAttributeValues: {
      ":primaryNumber": { S: appointment.PrimaryPhoneNumber },
      ":secondaryNumber": { S: appointment.SecondaryPhoneNumber },
      ":email_address": { S: appointment.Email },
      ":appointmentAccessibility": {
        M: {
          accessibleToilet: {
            BOOL: appointment.AppointmentAccessibility.accessibleToilet,
          },
          disabledParking: {
            BOOL: appointment.AppointmentAccessibility.disabledParking,
          },
          inductionLoop: {
            BOOL: appointment.AppointmentAccessibility.inductionLoop,
          },
          signLanguage: {
            BOOL: appointment.AppointmentAccessibility.signLanguage,
          },
          stepFreeAccess: {
            BOOL: appointment.AppointmentAccessibility.stepFreeAccess,
          },
          wheelchairAccess: {
            BOOL: appointment.AppointmentAccessibility.wheelchairAccess,
          },
        },
      },
      ":communicationsAccessibility": {
        M: {
          signLanguage: {
            BOOL: appointment.CommunicationsAccessibility.signLanguage,
          },
          braille: {
            BOOL: appointment.CommunicationsAccessibility.braille,
          },
          interpreter: {
            BOOL: appointment.CommunicationsAccessibility.interpreter,
          },
          language: {
            S: appointment.CommunicationsAccessibility.language,
          },
        },
      },
      ":notificationPreferences": {
        M: {
          canEmail: {
            BOOL: appointment.NotificationPreferences.canEmail,
          },
          canSMS: {
            BOOL: appointment.NotificationPreferences.canSMS,
          },
        },
      },
      ":time_stamp": { S: appointment.Timestamp },
    },
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${partitionKeyValue}`);
  } else {
    console.log(`Updated Appointment successfully`);
  }
  return response.$metadata.httpStatusCode;
}
