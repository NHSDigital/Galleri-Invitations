import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

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
    addCancerSignalOriginTable(dbClient);
  } catch (error) {
    console.error(
      "Error: failed with cancer signal origin extraction, procession or uploading",
      error
    );
  }
};

//DYNAMODB FUNCTIONS
export async function addCancerSignalOriginTable(
  client,
  appointment,
  table = `${ENVIRONMENT}-CancerSignalOrigin`
) {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = appointment.participantID;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression:
      "SET primary_phone_number = :primaryNumber, secondary_phone_number = :secondaryNumber, email_address = :email_address, appointment_accessibility = :appointmentAccessibility, communications_accessibility = :communicationsAccessibility, notification_preferences= :notificationPreferences, Time_stamp = :time_stamp ",
    ExpressionAttributeValues: {
      ":primaryNumber": { S: appointment.PrimaryPhoneNumber },
      ":secondaryNumber": { S: appointment.SecondaryPhoneNumber },
      ":email_address": { S: appointment.Email },
      ":appointmentAccessibility": { M: appointment.AppointmentAccessibility },
      ":communicationsAccessibility": {
        M: appointment.CommunicationsAccessibility,
      },
      ":notificationPreferences": { M: appointment.NotificationPreferences },
      ":time_stamp": { S: appointment.Timestamp },
    },
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${partitionKeyValue}`);
  }
  return response.$metadata.httpStatusCode;
}
