import { getSecret, chunking, multipleUpload, pushCsvToS3 } from "./helper.js";
import {
  handShake,
  loadConfig,
  getMessageCount,
  readMessage,
  markAsRead,
} from "nhs-mesh-client";
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import fs from "fs";
import chunkCsv from "chunk-csv";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});

const ENVIRONMENT = process.env.ENVIRONMENT;
const MESH_CHUNK_VALUE = process.env.MESH_CHUNK_VALUE;
const EXIT_TIME = process.env.EXIT_TIME;
//retrieve secrets into lambda, certificates required to connect to MESH
const MESH_SENDER_CERT = await readSecret("MESH_SENDER_CERT", smClient);
const MESH_SENDER_KEY = await readSecret("MESH_SENDER_KEY", smClient);
const CAAS_MESH_CERT = await readSecret("CAAS_MESH_CERT", smClient); //fetching caas cert, was receiver
const MESH_CAAS_KEY = await readSecret("MESH_SENDER_KEY", smClient);
const FILE_PATH = process.env.FILE_OUTPUT_PATH;
const FILE_EXTENSION = process.env.FILE_EXTENSION;

// Set environment variables
const CONFIG = await loadConfig({
  url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
  sharedKey: process.env.MESH_SHARED_KEY,
  sandbox: "false",
  senderCert: MESH_SENDER_CERT,
  senderKey: MESH_SENDER_KEY,
  senderMailboxID: process.env.CAAS_MESH_MAILBOX_ID,
  senderMailboxPassword: process.env.CAAS_MESH_MAILBOX_PASSWORD,
  receiverCert: CAAS_MESH_CERT,
  receiverKey: MESH_CAAS_KEY,
  receiverMailboxID: process.env.CAAS_MESH_MAILBOX_ID,
  receiverMailboxPassword: process.env.CAAS_MESH_MAILBOX_PASSWORD,
});

//HANDLER
export const handler = async (event, context) => {
  const finalMsgArr = [];
  try {
    let startTime = performance.now();
    console.log("healthy test");
    let healthy = await getHealthStatusCode();
    let keepProcessing = true;
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      while (keepProcessing) {
        let timeTaken = performance.now() - startTime;
        let messageArr = await getMessageArray(); //return arr of message ids
        console.log(`messageArr ${messageArr}`);
        if (messageArr.length > 0) {
          for (let i = 0; i < messageArr.length; i++) {
            let message = await readMsg(messageArr[i]); //reads the message and save it in /tmp folder of lambda
            await uploadChunkedCsvToS3(messageArr[i]); // from /tmp, save the message after breaking them into chunks
            timeTaken = performance.now() - startTime;
            console.log(`Time taken: ${timeTaken} milliseconds`);
            if (timeTaken >= EXIT_TIME * 1000 * 60) {
              //represents a minute in milliseconds
              console.log("Gracefully exiting lambda function");
              keepProcessing = false;
              break;
            }
          }
        } else {
          console.log("No Messages");
          keepProcessing = false;
          break;
        }
      }
    } else {
      console.log("Failed to establish connection");
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

async function uploadChunkedCsvToS3(msgID) {
  return chunkCsv
    .split(
      fs.createReadStream(`${FILE_PATH}/${msgID}.${FILE_EXTENSION}`),
      {
        lineLimit: MESH_CHUNK_VALUE,
      },
      async (chunk, index) => {
        const dateTime = new Date(Date.now()).toISOString();
        const filename = `mesh_chunk_data_${index}_${dateTime}`;
        let response = await pushCsvToS3(
          `${ENVIRONMENT}-galleri-caas-data`,
          `${filename}.csv`,
          chunk,
          clientS3
        );
        if (response.$metadata.httpStatusCode === 200) {
          const response1 = await markRead(msgID); //remove message after actioned message
          console.log(`${response1.status} ${response1.statusText}`);
        } else {
          console.error("Error uploading item ");
        }
      }
    )
    .then((csvSplitResponse) => {
      console.log("csvSplitStream succeeded.", csvSplitResponse);
    })
    .catch((csvSplitError) => {
      console.log("csvSplitStream failed!", csvSplitError);
    });
}

//FUNCTIONS
/**
 * Read in MESH data
 *
 * @function getHealthStatusCode
 * @async
 * @returns {Promise<String>} Status code of handshake, expecting 200
 */
async function getHealthStatusCode() {
  try {
    let healthCheck = await handShake({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.receiverAgent,
    });

    return healthCheck.status;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

/**
 * Return an array of message IDs
 *
 * @function getMessageArray
 * @async
 * @returns {Promise<Array>} Returns an array of message ids read from the mailbox
 */
async function getMessageArray() {
  try {
    let messageCount = await getMessageCount({
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
}

/**
 * Marks messaged as read based on the message ID passed in
 *
 * @function markRead
 * @async
 * @param {string} msgID - The message which you want to mark as read
 * @returns {Promise<Object>} Object containing data about request, including if it was successful
 */
async function markRead(msgID) {
  try {
    let markMsg = await markAsRead({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      message: msgID,
      agent: CONFIG.receiverAgent,
    });
    return markMsg;
  } catch (error) {
    console.error(`Error marking message ${messageID} as read: ${err}`);
  }
}

/**
 * Reads message data based on message ID
 *
 * @function ReadMsg
 * @async
 * @param {string} msgID - The message which you want to read
 * @returns {Promise<String>} The message body
 */
async function readMsg(msgID) {
  try {
    let messages = await readMessage({
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
}

/**
 * Retrieves large secrets into lambda
 *
 * @function readSecret
 * @async
 * @param {string} secretName - Secret name stored in AWS
 * @param {SecretsManagerClient} client - An instance of secrets manager client
 * @returns {Promise<String>} secret value
 */
async function readSecret(secretName, client) {
  return Buffer.from(await getSecret(secretName, client), "base64").toString(
    "utf8"
  );
}
//END OF FUNCTIONS
