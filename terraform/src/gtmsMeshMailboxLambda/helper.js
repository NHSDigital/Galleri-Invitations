import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { handShake, getMessageCount, markAsRead, readMessage } from "nhs-mesh-client";

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
const handshake = handShake;
//Establish connection with MESH
export const run = async (CONFIG, handshake) => {

  try {
    // console.log(CONFIG);
    // console.log(handshake);
    const healthCheck = await handshake({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.receiverAgent,
    });

    // console.log(healthCheck);
    return healthCheck.status;
  } catch (error) {
    console.error(`Error occurred: ${error}`);
  }
}

const msgCount = getMessageCount;
//Return an array of message IDs
export const getMessageArray = async (CONFIG, msgCount) => {
  try {
    // console.log(CONFIG);
    // console.log(msgCount);
    let messageCount = await msgCount({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      agent: CONFIG.receiverAgent,
    });
    // console.log(messageCount);
    let messageList = messageCount.data.messages
    let inboxCount = messageCount.data.approx_inbox_count;
    console.log(`Inbox contains ${inboxCount} messages`);
    return messageList;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

const marked = markAsRead;
//Marks messaged as read based on the message ID passed in
export const markRead = async (CONFIG, marked, msgID) => {
  try {
    // console.log(CONFIG);
    // console.log(msgCount);
    // console.log(msgID);
    let markMsg = await marked({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      message: msgID,
      agent: CONFIG.receiverAgent,
    });
    // console.log('final');
    // console.log(markMsg);
    return markMsg;
  } catch (error) {
    console.error(`Error occurred: ${error}`);
  }
}

const readingMsg = readMessage;
//Reads message data based on message ID
export const readMsg = async (CONFIG, readingMsg, msgID) => {
  try {
    // console.log(CONFIG);
    // console.log(msgCount);
    // console.log(msgID);
    let messages = await readingMsg({
      url: CONFIG.url,
      mailboxID: CONFIG.receiverMailboxID,
      mailboxPassword: CONFIG.receiverMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      messageID: msgID,
      agent: CONFIG.receiverAgent,
    });
    // console.log(messages.data);
    return messages.data;
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
