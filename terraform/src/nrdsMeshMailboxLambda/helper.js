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

/**
 * Pushes a CSV file to S3.
 *
 * @function pushCsvToS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the object to be saved in the S3 bucket.
 * @param {string} body - The contents of the object to be saved in the S3 bucket.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<Object>} Resolves to the response from the S3 client.
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
    console.log(`Failed: ${err}`);
    throw err;
  }
};
/**
 * Retrieves 'Secret value' from secrets manager by passing in 'Secret name' from AWS Secrets Manager
 *
 * @function getSecret
 * @async
 * @param {string} secretName - Name of the secret to retrieve
 * @param {SecretsManagerClient} client - Secrets Manager client
 * @returns {string} Secret value
 * @throws {Error} If there is an error retrieving the secret
 */
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

/**
 * Establish connection with MESH
 *
 * @function getHealthStatusCode
 * @async
 * @param {Object} CONFIG - Configuration obj includes mailbox id, certs etc
 * @param {Function} handshake - Replace handshake with handShake fn
 * @returns {Promise<string>}
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

/**
 * Return an array of message IDs from MESH
 *
 * @function getMessageArray
 * @async
 * @param {Object} CONFIG - Configuration obj includes mailbox id, certs etc
 * @param {Function} msgCount - Replace msgCount with getMessageCount fn
 * @returns {Promise<Array>}
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

/**
 * Marks messaged as read based on the message ID passed in, subsequently removing message from MESH mailbox
 *
 * @function markRead
 * @async
 * @param {Object} CONFIG - Configuration obj includes mailbox id, certs etc
 * @param {Function} marked - Replace marked with markAsRead fn
 * @param {string} msgID - Message you want to querying
 * @returns {Promise<Object>}
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

/**
 * Reads message data from Mesh based on message ID
 *
 * @function readMsg
 * @async
 * @param {Object} CONFIG - Configuration obj includes mailbox id, certs etc
 * @param {Function} readingMsg - Replace readingMsg with readMessage fn
 * @param {string} msgID - Message you want to querying
 * @returns {Promise<string}
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
    });
    return messages;
  } catch (error) {
    console.error("Error occurred:", error);
  }
};
