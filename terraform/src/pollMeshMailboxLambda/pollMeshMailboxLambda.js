import { pushCsvToS3, getSecret, chunking, multipleUpload } from "./helper.js"
import { handShake, loadConfig, getMessageCount, sendMessageChunks, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});

const ENVIRONMENT = process.env.ENVIRONMENT;

//retrieve secrets into lambda, certificates required to connect to MESH
const meshSenderCert = Buffer.from(
  await getSecret("MESH_SENDER_CERT", smClient),
  "base64"
).toString("utf8");
const meshSenderKey = Buffer.from(
  await getSecret("MESH_SENDER_KEY", smClient),
  "base64"
).toString("utf8");
const meshReceiverCert = Buffer.from(
  await getSecret("MESH_RECEIVER_CERT", smClient),
  "base64"
).toString("utf8");
const meshReceiverKey = Buffer.from(
  await getSecret("MESH_RECEIVER_KEY", smClient),
  "base64"
).toString("utf8");

//Set environment variables
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

//FUNCTIONS
//Read in MESH data
async function run() {
  try {
    let healthCheck = await handShake({
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

//Return an array of message IDs
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
    return messageList;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//For loading data to MESH (testing)
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

//Marks messaged as read based on the message ID passed in
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
    return markMsg;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//Reads message data based on message ID
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
    return messageData;
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
    console.log('healthy test');
    let healthy = await run();
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      let messageArr = await runMessage(); //return arr of message ids
      console.log('messageArr');
      console.log(messageArr);
      if (messageArr.length > 0) {
        for (let i = 0; i < messageArr.length; i++) {
          let message = await readMsg(messageArr[i]); //returns messages based on id, iteratively from message list arr
          console.log(messageArr[i]);
          finalMsgArr.push(message);

          const meshString = finalMsgArr[0];
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



