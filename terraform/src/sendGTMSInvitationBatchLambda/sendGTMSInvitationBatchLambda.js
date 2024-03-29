// import { getSecret, pushToS3 } from "./helper.js"
import { handShake, loadConfig, sendMessage, readMessage } from "nhs-mesh-client";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const WORKFLOW_ID = process.env.WORKFLOW_ID;
const SENT_BUCKET = `${ENVIRONMENT}-sent-gtms-invited-participant-batch`;

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  //inside handler so they do not need to be mocked globally
  //retrieve secrets into lambda, certificates required to connect to MESH
  const MESH_SENDER_CERT = await readSecret(getSecret, "MESH_SENDER_CERT", smClient);
  const MESH_SENDER_KEY = await readSecret(getSecret, "MESH_SENDER_KEY", smClient);
  const MESH_RECEIVER_CERT = await readSecret(getSecret, "MESH_RECEIVER_CERT", smClient);
  const MESH_RECEIVER_KEY = await readSecret(getSecret, "MESH_RECEIVER_KEY", smClient);
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
    receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
    receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
  });
  const KEY_PREFIX = "invitation_batch_";
  const timestamp = (new Date(Date.now())).toISOString();

  try {
    const JSONMsgObj = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);
    const { preSendMsgObjectLength, sentMsgID } = await sendMessageToMesh(sendUncompressed, KEY_PREFIX, timestamp, CONFIG, JSONMsgObj);
    const { postReceiveReadMsgStatus, postReceiveMsgObject } = await readMeshMessage(readMsg, CONFIG, sentMsgID);
    await handleReceivedMessage(pushJsonToS3, deleteObjectFromS3, KEY_PREFIX, timestamp, preSendMsgObjectLength, postReceiveMsgObject, postReceiveReadMsgStatus, bucket, key, s3);
  } catch (error) {
    console.error("Error occurred:", error);
  }
};


//FUNCTIONS

// Retrieve and Parse the JSON file
export const retrieveAndParseJSON = async (getJSONFunc, bucket, key, client) => {
  const JSONMsgStr = await getJSONFunc(bucket, key, client);
  return JSON.parse(JSONMsgStr);
};

// Send Message to Mesh Mailbox, returns the length of the object prior and sent Message ID
export const sendMessageToMesh = async (sendFunc, KEY_PREFIX, timestamp, CONFIG, JSONMsgObj) => {
  const { length: preSendMsgObjectLength } = JSONMsgObj;
  const sentMsgID = await sendFunc(CONFIG, JSONMsgObj, `${KEY_PREFIX}${timestamp}.json`, handShake, sendMessage);
  console.log("PRESEND JSON OBJECT LENGTH", preSendMsgObjectLength)
  return { preSendMsgObjectLength, sentMsgID };
};


//Read the message after sending it to Mesh Mailbox
export const readMeshMessage = async (readMsgFunc, CONFIG, sentMsgID) => {
  const { status: postReceiveReadMsgStatus, data: postReceiveMsgObject } = await readMsgFunc(CONFIG, sentMsgID, readMessage);
  console.log("POST RECEIVED JSON OBJECT LENGTH", postReceiveMsgObject.length);
  return { postReceiveReadMsgStatus, postReceiveMsgObject };
};

// Checking if Message has been received on the receiver Mailbox and if the
// total number of records sent is equal to prior.
// If both conditions are True, push the sent object to SENT Bucket and delete the fetched
// object from the outbound bucket
export const handleReceivedMessage = async (pushJsonFunc, deleteObjectFunc, KEY_PREFIX, timestamp, preSendMsgObjectLength, postReceiveMsgObject, postReceiveReadMsgStatus, bucket, key, client) => {
  if (preSendMsgObjectLength === postReceiveMsgObject.length && postReceiveReadMsgStatus === 200) {
    const pushJsonToS3Status = await pushJsonFunc(client, SENT_BUCKET, `sent-${KEY_PREFIX}${timestamp}.json`, postReceiveMsgObject);
    if (pushJsonToS3Status === 200) {
      await deleteObjectFunc(bucket, key, client);
    }
  }
};


// Get JSON File from the bucket
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
// PUSH JSON File to an S3 bucket
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
    return response.$metadata.httpStatusCode
  } catch (err) {
    console.error("Error pushing to S3: ", err);
    throw err;
  }
};

// Delete an object from an S3 bucket
export async function deleteObjectFromS3(bucketName, objectKey, client) {
  try {
    const response = await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
    console.log(`Object "${objectKey}" deleted successfully from bucket "${bucketName}".`);
    return response.$metadata.httpStatusCode;
  } catch (err) {
    console.error(`Error deleting object "${objectKey}" from bucket "${bucketName}":`, err);
    throw err;
  }
}


//Send Message based on the MailBox ID from the config
export async function sendUncompressed(config, msg, filename, performHandshake, dispatchMessage) {
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
      throw new Error(`Create Message Failed for ${filename}: ${message.status}`);
    } else {
      console.log(`Successfully sent ${filename} to GTMS mailbox`);
      return message.data.message_id;
    }
  } catch (error) {
    throw error;
  }
}

//Reads message data based on message ID
export async function readMsg(config, msgID, retrieveMessage) {
  try {
    let messages = await retrieveMessage({
      url: config.url,
      mailboxID: config.receiverMailboxID,
      mailboxPassword: config.receiverMailboxPassword,
      sharedKey: config.sharedKey,
      messageID: msgID,
      agent: config.receiverAgent,
    });
    return messages;
  } catch (error) {
    throw error;
  }
}

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
    console.log(`Failed: ${error}`);
    throw error;
  }
}

export async function readSecret(fetchSecret, secretName, client) {
  return Buffer.from(
    await fetchSecret(secretName, client),
    "base64"
  ).toString("utf8");
}
//END OF FUNCTIONS

