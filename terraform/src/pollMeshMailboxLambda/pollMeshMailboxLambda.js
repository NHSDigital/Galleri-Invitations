import { getSecret, chunking, multipleUpload } from "./helper.js"
import { handShake, loadConfig, getMessageCount, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});

const ENVIRONMENT = process.env.ENVIRONMENT;

//retrieve secrets into lambda, certificates required to connect to MESH
const MESH_SENDER_CERT = await readSecret("MESH_SENDER_CERT", smClient);
const MESH_SENDER_KEY = await readSecret("MESH_SENDER_KEY", smClient);
const MESH_RECEIVER_CERT = await readSecret("MESH_RECEIVER_CERT", smClient);
const MESH_RECEIVER_KEY = await readSecret("MESH_RECEIVER_KEY", smClient);

//Set environment variables
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
  receiverMailboxID: process.env.CAAS_RECEIVER_MAILBOX_ID, // updated, before was set to test receiver mailbox id
  receiverMailboxPassword: process.env.CAAS_RECEIVER_MAILBOX_PASSWORD, // updated, before was set to test receiver mailbox password
});

//HANDLER
export const handler = async (event, context) => {
  const finalMsgArr = [];
  try {
    console.log('healthy test');
    let healthy = await getHealthStatusCode();
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      let messageArr = await getMessageArray(); //return arr of message ids
      console.log(`messageArr ${messageArr}`);
      if (messageArr.length > 0) {
        for (let i = 0; i < messageArr.length; i++) {
          let message = await readMsg(messageArr[i]); //returns messages based on id, iteratively from message list arr
          finalMsgArr.push(message);

          const meshString = finalMsgArr[i];
          const splitMeshString = meshString.split("\n");
          const header = splitMeshString[0];
          const messageBody = splitMeshString.splice(1); //data - header

          const x = new Set(messageBody);
          let chunk = [...chunking(x, 2001, header)]; //includes header and 2000 records

          const upload = await multipleUpload(chunk, clientS3, ENVIRONMENT);
          if (upload[0].$metadata.httpStatusCode === 200) {
            const response = await markRead(messageArr[i]); //remove message after actioned message
            console.log(`${response.status} ${response.statusText}`);
          }
        }
      } else {
        console.log('No Messages');
      }
    } else {
      console.log('Failed to establish connection');
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};


//FUNCTIONS
//Read in MESH data
async function getHealthStatusCode() {
  try {
    let healthCheck = await handShake({
      url: CONFIG.url,
      mailboxID: CONFIG.senderMailboxID,
      mailboxPassword: CONFIG.senderMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.senderAgent,
    });

    return healthCheck.status
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//Return an array of message IDs
async function getMessageArray() {
  try {
    let messageCount = await getMessageCount({
      url: CONFIG.url,
      mailboxID: CONFIG.senderMailboxID,
      mailboxPassword: CONFIG.senderMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.senderAgent,
    });
    let messageList = messageCount.data.messages
    let inboxCount = messageCount.data.approx_inbox_count;
    console.log(`Inbox contains ${inboxCount} messages`);
    return messageList;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//Marks messaged as read based on the message ID passed in
async function markRead(msgID) {
  try {
    let markMsg = await markAsRead({
      url: CONFIG.url,
      mailboxID: CONFIG.senderMailboxID,
      mailboxPassword: CONFIG.senderMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      message: msgID,
      agent: CONFIG.senderAgent,
    });
    return markMsg;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//Reads message data based on message ID
async function readMsg(msgID) {
  try {
    let messages = await readMessage({
      url: CONFIG.url,
      mailboxID: CONFIG.senderMailboxID,
      mailboxPassword: CONFIG.senderMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      messageID: msgID,
      agent: CONFIG.senderAgent,
    });
    return messages.data;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function readSecret(secretName, client) {
  return Buffer.from(
    await getSecret(secretName, client),
    "base64"
  ).toString("utf8");
}
//END OF FUNCTIONS

