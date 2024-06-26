// import { getSecret, pushToS3 } from "./helper.js"
import { handShake, loadConfig, sendMessage } from "nhs-mesh-client";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const WORKFLOW_ID = process.env.WORKFLOW_ID;
const SENT_BUCKET = `${ENVIRONMENT}-sent-gtms-invited-participant-batch`;
const GTMS_MESH_RECEIVER_MAILBOX_ID = process.env.GTMS_MESH_RECEIVER_MAILBOX_ID;

/**
 * Lambda handler function to process JSON File uploaded to
 * S3 bucket, send the file via Mesh mailbox. After the file is
 * sent, upload it to the sent bucket and delete the file from initial bucket.
 *
 * @function handler
 * @async
 * @param {Object} event - S3 event triggering the Lambda function.
 * @param {Object} context - The context of the Lambda function
 */
//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  //inside handler so they do not need to be mocked globally
  //retrieve secrets into lambda, certificates required to connect to MESH
  const MESH_SENDER_CERT = await readSecret(
    getSecret,
    "MESH_SENDER_CERT",
    smClient
  );
  const MESH_SENDER_KEY = await readSecret(
    getSecret,
    "MESH_SENDER_KEY",
    smClient
  );
  const MESH_RECEIVER_CERT = await readSecret(
    getSecret,
    "MESH_RECEIVER_CERT",
    smClient
  );
  const MESH_RECEIVER_KEY = await readSecret(
    getSecret,
    "MESH_RECEIVER_KEY",
    smClient
  );
  const CONFIG = await loadConfig({
    url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
    sharedKey: process.env.MESH_SHARED_KEY,
    sandbox: "false",
    senderCert: MESH_SENDER_CERT,
    senderKey: MESH_SENDER_KEY,
    senderMailboxID: process.env.MESH_SENDER_MAILBOX_ID,
    senderMailboxPassword: process.env.MESH_SENDER_MAILBOX_PASSWORD,
    receiverCert: MESH_RECEIVER_CERT,
    receiverKey: MESH_RECEIVER_KEY,
    receiverMailboxID: GTMS_MESH_RECEIVER_MAILBOX_ID,
  });
  const KEY_PREFIX = "invitation_batch_";
  const timestamp = new Date(Date.now()).toISOString();

  try {
    const JSONMsgObj = await retrieveAndParseJSON(
      getJSONFromS3,
      bucket,
      key,
      s3
    );
    const sentMsgStatus = await sendMessageToMesh(
      sendUncompressed,
      KEY_PREFIX,
      timestamp,
      CONFIG,
      JSONMsgObj
    );
    await handleSentMessageFile(
      pushJsonToS3,
      deleteObjectFromS3,
      KEY_PREFIX,
      timestamp,
      JSONMsgObj,
      sentMsgStatus,
      bucket,
      key,
      s3
    );
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

//FUNCTIONS

/**
 * This function retrieves and parse JSON file from S3 bucket
 *
 * @function retrieveAndParseJSON
 * @async
 * @param {Function} getJSONFunc - Function to get JSON from S3
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {S3Client} client - S3 client
 * @returns {Object} Parsed JSON object
 * @throws {Error} If there is an error retrieving or parsing the JSON file
 */
export const retrieveAndParseJSON = async (
  getJSONFunc,
  bucket,
  key,
  client
) => {
  const JSONMsgStr = await getJSONFunc(bucket, key, client);
  return JSON.parse(JSONMsgStr);
};

/**
 * Sends Message to Mesh Mailbox, returns the length of the object prior and sent Message ID
 *
 * @function sendMessageToMesh
 * @async
 * @param {Function} sendFunc - Function to send message
 * @param {string} KEY_PREFIX - Prefix for the key
 * @param {string} timestamp - Timestamp for the message
 * @param {Object} CONFIG - Configuration object
 * @param {Object} JSONMsgObj - JSON message object
 * @returns {number} Status of the sent message
 */
export const sendMessageToMesh = async (
  sendFunc,
  KEY_PREFIX,
  timestamp,
  CONFIG,
  JSONMsgObj
) => {
  const { length: preSendMsgObjectLength } = JSONMsgObj;
  const sentMsgStatus = await sendFunc(
    CONFIG,
    JSONMsgObj,
    `${KEY_PREFIX}${timestamp}.json`,
    handShake,
    sendMessage
  );
  console.log("PRESEND JSON OBJECT LENGTH", preSendMsgObjectLength);
  return sentMsgStatus;
};

/**
 * Handles the sent message file.
 * If the status after sending the JSON message is 202,
 * push the sent object to SENT Bucket and delete the
 * fetched object from the outbound bucket.
 *
 * @function handleSentMessageFile
 * @async
 * @param {Function} pushJsonFunc - Function to push JSON to S3
 * @param {Function} deleteObjectFunc - Function to delete object from S3
 * @param {string} KEY_PREFIX - Prefix for the key
 * @param {string} timestamp - Timestamp for the message
 * @param {Object} JSONMsgObj - JSON message object
 * @param {number} sentMsgStatus - Status of the sent message
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {S3Client} client - S3 client
 */
export const handleSentMessageFile = async (
  pushJsonFunc,
  deleteObjectFunc,
  KEY_PREFIX,
  timestamp,
  JSONMsgObj,
  sentMsgStatus,
  bucket,
  key,
  client
) => {
  if (sentMsgStatus === 202) {
    const pushJsonToS3Status = await pushJsonFunc(
      client,
      SENT_BUCKET,
      `sent-${KEY_PREFIX}${timestamp}.json`,
      JSONMsgObj
    );
    if (pushJsonToS3Status === 200) {
      await deleteObjectFunc(bucket, key, client);
    }
  }
};

/**
 * This function retrieves a JSON file from the S3 bucket
 *
 * @function getJSONFromS3
 * @async
 * @param {string} bucketName - Name of the S3 bucket
 * @param {string} key - Key of the object in the S3 bucket
 * @param {S3Client} client - S3 client
 * @returns {string} JSON string from the S3 object
 * @throws {Error} If there is an error retrieving the JSON file
 */
export async function getJSONFromS3(bucketName, key, client) {
  console.log(`Getting object key ${key} from bucket ${bucketName}`);
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(`Finished getting object key ${key} from bucket ${bucketName}`);
    return response.Body.transformToString();
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
}

/**
 * Pushes a JSON file to the S3 bucket
 *
 * @function pushJsonToS3
 * @async
 * @param {S3Client} client - S3 client
 * @param {string} bucketName - Name of the S3 bucket
 * @param {string} key - Key for the object in the S3 bucket
 * @param {Object} jsonArr - JSON object to push
 * @returns {number} HTTP status code of the response
 * @throws {Error} If there is an error pushing the JSON file to S3
 */
export const pushJsonToS3 = async (client, bucketName, key, jsonArr) => {
  console.log(`Pushing object key ${key} to bucket ${bucketName}`);
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(jsonArr),
      })
    );
    console.log(`Finished pushing object key ${key} to bucket ${bucketName}`);
    return response.$metadata.httpStatusCode;
  } catch (err) {
    console.error("Error pushing to S3: ", err);
    throw err;
  }
};

/**
 * Deletes an object from an S3 bucket
 *
 * @function deleteObjectFromS3
 * @async
 * @param {string} bucketName - Name of the S3 bucket
 * @param {string} objectKey - Key of the object in the S3 bucket
 * @param {S3Client} client - S3 client
 * @returns {number} HTTP status code of the response
 * @throws {Error} If there is an error deleting the object from S3
 */
export async function deleteObjectFromS3(bucketName, objectKey, client) {
  try {
    const response = await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
    console.log(
      `Object "${objectKey}" deleted successfully from bucket "${bucketName}".`
    );
    return response.$metadata.httpStatusCode;
  } catch (err) {
    console.error(
      `Error deleting object "${objectKey}" from bucket "${bucketName}":`,
      err
    );
    throw err;
  }
}

/**
 * Sends an uncompressed message to the MESH mailbox,
 * based on the MailBox ID from the config.
 *
 * @function sendUncompressed
 * @async
 * @param {Object} config - Configuration object
 * @param {Object} msg - Message object
 * @param {string} filename - Name of the file retrieved from S3 bucket. (file that triggered the lambda)
 * @returns {number} HTTP status code of the response
 * @throws {Error} If there is an error sending the uncompressed message
 */
export async function sendUncompressed(
  config,
  msg,
  filename,
  performHandshake,
  dispatchMessage
) {
  console.log(`Sending ${filename} to GTMS Mailbox`);
  try {
    let healthCheck = await performHandshake({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });

    if (healthCheck.status != 200) {
      throw new Error(`Health Check Failed: ${healthCheck}`);
    }

    let message = await dispatchMessage({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      message: msg,
      mailboxTarget: config.receiverMailboxID,
      agent: config.senderAgent,
      workFlowId: WORKFLOW_ID,
      fileName: filename,
    });

    if (message.status != 202) {
      throw new Error(
        `Create Message Failed for ${filename}: ${message.status}`
      );
    } else {
      console.log(`Successfully sent ${filename} to GTMS mailbox`);
      return message.status;
    }
  } catch (error) {
    throw error;
  }
}

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
 * Reads a secret from AWS Secrets Manager
 *
 * @function readSecret
 * @async
 * @param {Function} fetchSecret - Function to get the secret
 * @param {string} secretName - Name of the secret to retrieve
 * @param {Object} client - Secrets Manager client
 * @returns {string} Secret value
 */
export async function readSecret(fetchSecret, secretName, client) {
  return Buffer.from(await fetchSecret(secretName, client), "base64").toString(
    "utf8"
  );
}
//END OF FUNCTIONS
