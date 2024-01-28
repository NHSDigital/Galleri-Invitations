//IMPORTS
import { getSecret } from "./helper.js"
import { handShake, loadConfig, getMessageCount, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});


const ENVIRONMENT = process.env.ENVIRONMENT;

const GTMS_MESH_CERT = await readSecret("GTMS_MESH_CERT", smClient);
const MESH_GTMS_KEY = await readSecret("MESH_SENDER_KEY", smClient);

const CONFIG = await loadConfig({
  url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
  sharedKey: process.env.MESH_SHARED_KEY,
  sandbox: "false",
  senderCert: GTMS_MESH_CERT,
  senderKey: MESH_GTMS_KEY,
  senderMailboxID: process.env.MESH_SENDER_MAILBOX_ID,
  senderMailboxPassword: process.env.MESH_SENDER_MAILBOX_PASSWORD,
  receiverCert: GTMS_MESH_CERT,
  receiverKey: MESH_GTMS_KEY,
  receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
  receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
});

//HANDLER
export const handler = async (event, context) => {
  try {
    console.log('healthy test');
    let healthy = await run();
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      let messageArr = await getMessageArray(); //return arr of message ids
      console.log(`messageArr ${messageArr}`);
      if (messageArr.length > 0) {
        for (let i = 0; i < messageArr.length; i++) {
          let message = await readMsg(messageArr[i]); //returns messages based on id, iteratively from message list arr
          console.log(message.data); //observing if format is correct for msg
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};


//FUNCTIONS
//Establish connection with MESH
async function run() {
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
