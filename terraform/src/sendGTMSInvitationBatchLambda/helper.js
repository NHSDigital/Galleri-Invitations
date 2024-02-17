import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";


// This config will be used by the each of the following functions to define
// The mailboxes we will be using and the content of messages.
// const config = await loadConfig({
//   logLevel: "DEBUG",
//   url: "https://msg.intspineservices.nhs.uk",
//   sharedKey: process.env.MESH_SHARED_KEY,
//   sandbox: "false",
//   senderCert: process.env.MESH_SENDER_CERT_LOCATION,
//   senderKey: process.env.MESH_SENDER_KEY_LOCATION,
//   senderMailboxID: process.env.MESH_SENDER_MAILBOX_ID,
//   senderMailboxPassword: process.env.MESH_SENDER_MAILBOX_PASSWORD,
//   receiverCert: process.env.MESH_RECEIVER_CERT_LOCATION,
//   receiverKey: process.env.MESH_RECEIVER_KEY_LOCATION,
//   receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
//   receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
// });

// log.setLevel(log.levels[config.logLevel]);

// The following functions are setup to satisfy the conformance
// Testing that each mesh application is required to go though.

export async function sendUncompressed(config, handShake, sendMessage) {
  try {
    let healthCheck = await handShake({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });

    if (healthCheck.status != 200) {
      log.error(`Health Check Failed: ${healthCheck}`);
      process.exit(1);
    }

    let message = await sendMessage({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      message: "This is an uncompressed message",
      mailboxTarget: config.receiverMailboxID,
      agent: config.senderAgent,
    });

    if (message.status != 202) {
      log.error(`Create Message Failed: ${message.status}`);
      process.exit(1);
    }
  } catch (error) {
    log.error("An error occurred:", error.message);
    process.exit(1);
  }
}

//Push JSON file to S3
export const pushToS3 = async (bucketName, key, body, client) => {
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
