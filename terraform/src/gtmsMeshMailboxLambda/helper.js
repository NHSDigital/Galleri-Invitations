import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  handShake,
  getMessageCount,
  markAsRead,
  readMessage,
} from "nhs-mesh-client";

const FILE_PATH = process.env.FILE_OUTPUT_PATH;
const FILE_EXTENSION = process.env.FILE_EXTENSION;

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
    console.log(`Failed: ${err}`);
    throw err;
  }
};

//Return 'Secret value' from secrets manager by passing in 'Secret name'
export const getSecret = async (secretName, client) => {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log(`Failed: ${error}`);
    throw error;
  }
};

/*
 * Establish connection with MESH
 * @params handshake to be replaced with handShake fn
 */
export const getHealthStatusCode = async (CONFIG, handshake) => {
  try {
    const healthCheck = await handshake({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.receiverAgent,
    });

    return healthCheck.status;
  } catch (error) {
    console.error(`Error occurred: ${error}`);
  }
};
/*
 * Return an array of message IDs from MESH
 * @params msgCount to be replaced with getMessageCount fn
 */
export const getMessageArray = async (CONFIG, msgCount) => {
  try {
    let messageCount = await msgCount({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.receiverAgent,
    });
    let messageList = messageCount.data.messages;
    let inboxCount = messageCount.data.approx_inbox_count;
    if (!inboxCount) {
      inboxCount = 0;
    }
    console.log(`Inbox contains ${inboxCount} messages`);
    return messageList;
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

/*
 * Marks messaged as read based on the message ID passed in,
 * subsequently removing message from MESH mailbox
 * @params marked to be replaced with markAsRead fn
 */
export const markRead = async (CONFIG, marked, msgID) => {
  try {
    let markMsg = await marked({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      message: msgID,
      agent: CONFIG.receiverAgent,
    });
    return markMsg;
  } catch (error) {
    console.error(`Error occurred: ${error}`);
  }
};
/*
 * Reads message data from MESH based on message ID
 * @params readingMsg to be replaced with readMessage fn
 */
export const readMsg = async (CONFIG, readingMsg, msgID) => {
  try {
    let messages = await readingMsg({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      messageID: msgID,
      agent: CONFIG.receiverAgent,
      outputFilePath: `${FILE_PATH}/${msgID}.${FILE_EXTENSION}`,
    });
    return messages;
  } catch (error) {
    console.error("Error occurred:", error);
  }
};
