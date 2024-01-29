import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

//Push string from MESH to S3
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
    console.log("Failed: ", err);
    throw err;
  }
};

//Return 'Secret value' from secrets manager by passing in 'Secret name'
export const getSecret = async (secretName, client) => {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log("Failed: ", error);
    throw error;
  }
}

export async function processMessage(message, environment, S3client, timestamp) {
  const dateTime = timestamp || new Date(Date.now()).toISOString()
  if (message?.ClinicCreateOrUpdate) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-clinic-create-or-update`,
      `clinic_create_or_update_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.ClinicScheduleSummary) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-clinic-schedule-summary`,
      `clinic_schedule_summary_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.InvitedParticipantBatch) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-invited-participant-batch`,
      `invited_participant_batch_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.Appointment) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-appointment`,
      `appointment_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.Withdrawal) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-withdrawal`,
      `withdrawal_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.SiteAccessibilityOptions) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-site-accessibility-options`,
      `site_accessibility_options_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.CommunicationAccessibility) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-communication-accessibility`,
      `communication_accessibility_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.InterpreterLanguage) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-interpreter-language`,
      `interpreter_language_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.NotificationPreferences) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-notification-preferences`,
      `notification_preferences_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }
}
