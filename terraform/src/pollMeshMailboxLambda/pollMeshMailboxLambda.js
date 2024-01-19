import { pushCsvToS3, getSecret, chunking, multipleUpload } from "./helper.js"
import { handShake, loadConfig, getMessageCount, sendMessageChunks, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from "stream"
import csv from "csv-parser";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});


const ENVIRONMENT = process.env.ENVIRONMENT;
// const MESH_SANDBOX = process.env.MESH_SANDBOX;
// const MESH_URL = process.env.MESH_URL;

let meshSenderCert = Buffer.from(
  await getSecret("MESH_SENDER_CERT", smClient),
  "base64"
).toString("utf8");
let meshSenderKey = Buffer.from(
  await getSecret("MESH_SENDER_KEY", smClient),
  "base64"
).toString("utf8");
let meshReceiverCert = Buffer.from(
  await getSecret("MESH_RECEIVER_CERT", smClient),
  "base64"
).toString("utf8");
let meshReceiverKey = Buffer.from(
  await getSecret("MESH_RECEIVER_KEY", smClient),
  "base64"
).toString("utf8");

const config = await loadConfig({
  url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
  sharedKey: process.env.MESH_SHARED_KEY,
  sandbox: "false",
  senderCert: meshSenderCert,
  senderKey: meshSenderKey,
  senderMailboxID: process.env.MESH_SENDER_MAILBOX_ID,
  senderMailboxPassword: process.env.MESH_SENDER_MAILBOX_PASSWORD,
  receiverCert: meshReceiverCert,
  receiverKey: meshReceiverKey,
  receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
  receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
});

//can remove, for testing purposes only
// const inputData = "/Users/abduls/repos/newProj/input/galleri_cohort_test_data_small.csv"

//FUNCTIONS
//Read in MESH data
async function run() {
  try {
    let healthCheck = await handShake({
      // url: MESH_URL,
      // mailboxID: MESH_SENDER_MAILBOX_ID,
      // mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      // sharedKey: MESH_SHARED_KEY,
      // // agent: config.senderAgent
      // agent: senderAgent
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });

    console.log(healthCheck.data);
    return healthCheck.status
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function runMessage() {
  try {
    let messageCount = await getMessageCount({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });
    let messageList = messageCount.data.messages
    let inboxCount = messageCount.data.approx_inbox_count;
    console.log(messageList);
    console.log(`Inbox contains ${inboxCount} messages`);
    // console.log(messageCount.data);
    return messageList;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//Can remove, for testing purposes only
async function sendMsg(msg) {
  try {
    let messageChunk = await sendMessageChunks({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      messageFile: msg,
      mailboxTarget: config.senderMailboxID,
      agent: config.senderAgent,
    });

    console.log(messageChunk.data);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function markRead(msgID) {
  try {
    let markMsg = await markAsRead({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      message: msgID,
      agent: config.senderAgent,
    });

    console.log(markMsg.data);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function readMsg(msgID) {
  try {
    let messages = await readMessage({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      messageID: msgID,
      agent: config.senderAgent,
    });
    const messageData = messages.data;
    // const messageData = messages;
    // console.log(messageData);
    return messageData;
    // return messageData;
    //mark message as read once file is created (do a conditional check)
    // markRead(msgID);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
//END OF FUNCTIONS

//HANDLER
export const handler = async (event, context) => {
  let finalMsgArr = [];
  const bucketName = `${ENVIRONMENT}-galleri-caas-data`;
  try {
    // let healthy = await run();
    // console.log(healthy);
    // await readMsg("20240118112144232103_89FA75");
    let message = await runMessage();
    console.log(message);
    console.log('healthy test');
    let healthy = await run();
    // console.log('abdul' + healthy);
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      let messageArr = await runMessage(); //return arr of message ids
      if (messageArr.length > 0) {
        for (let i = 0; i < messageArr.length; i++) {
          let message = await readMsg(messageArr[i]); //returns messages based on id, iteratively from message list arr
          //TODO: move chunk message here, chunk per message in message arr, then call s3 multiple upload func
          console.log(messageArr[i]);
          finalMsgArr.push(message);
          // console.log(message);
        }
      } else {
        console.log('No Messages');
      }
    } else {
      console.log('Failed to establish connection');
    }
    // console.log(finalMsgArr);
  } catch (error) {
    console.error("Error occurred:", error);
  }



  console.log(finalMsgArr);
  console.log('abdul -finalMsgArr');
  const meshString = finalMsgArr[0];
  const header = meshString.split("\n")[0];
  const messageBody = meshString.split("\n").splice(1);

  const x = new Set(messageBody);
  let chunk = [...chunking(x, 4, header)];
  console.log(chunk);

  try {
    multipleUpload(chunk, clientS3, ENVIRONMENT);
    // const dateTime = new Date(Date.now()).toISOString();

    // const filename = `mesh_chunk_data_${dateTime}`;
    // await pushCsvToS3(
    //   bucketName,
    //   `${filename}.csv`,
    //   meshString,
    //   clientS3
    // );
  } catch (e) {
    console.error("Error writing MESH data to bucket: ", e);
  }

};



