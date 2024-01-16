import { handShake, loadConfig, getMessageCount, sendMessageChunks, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from "stream"
import csv from "csv-parser";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const s3 = new S3Client({});
const config = await loadConfig();


const ENVIRONMENT = process.env.ENVIRONMENT;
const MESH_SANDBOX = process.env.MESH_SANDBOX;
const MESH_CA = process.env.MESH_CA;
const MESH_URL = process.env.MESH_URL;
const MESH_SHARED_KEY = process.env.MESH_SHARED_KEY_1;
const MESH_SENDER_MAILBOX_ID = process.env.MESH_SENDER_MAILBOX_ID;
const MESH_SENDER_MAILBOX_PASSWORD = process.env.MESH_SENDER_MAILBOX_PASSWORD;
const MESH_RECEIVER_MAILBOX_ID = process.env.MESH_RECEIVER_MAILBOX_ID;
const MESH_RECEIVER_MAILBOX_PASSWORD = process.env.MESH_RECEIVER_MAILBOX_PASSWORD;
const MESH_RECEIVER_KEY = process.env.MESH_RECEIVER_KEY;
const MESH_RECEIVER_CERT = process.env.MESH_RECEIVER_CERT;
const MESH_SENDER_KEY = process.env.MESH_SENDER_KEY;
const MESH_SENDER_CERT = process.env.MESH_SENDER_CERT;


//can remove, for testing purposes only
const inputData = "/Users/abduls/repos/newProj/input/galleri_cohort_test_data_small.csv"


// const MESH_CA_LOCATION = await getSecret(SECRET_MESH_CA_LOCATION);

//FUNCTIONS
//Read in MESH data
export const processData = async (csvString, callback) => {
  const dataArray = [];

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(callback(row));
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

async function getSecret(secretName) {
  let response = "";
  try {
    response = await smClient.send(
      new GetSecretValueCommand({
        SecretId: secretName
      })
    );
  } catch (error) {
    throw error;
  }
  const secret = response.SecretString;
  return secret;
}

export const callback = (arr) => {
  return arr;
  // let { eachNHS_NUMBER, eachSUPERSEDED_BY_NHS_NUMBER, eachSUPERSEDED_BY_NHS_NUMBER,
  //     eachPRIMARY_CARE_PROVIDER, eachGP_CONNECT, eachNAME_PREFIX,
  //     eachGIVEN_NAME, eachOTHER_GIVEN_NAMES, eachFAMILY_NAME, eachDATE_OF_BIRTH, eachGENDER, eachADDRESS_LINE_1,
  //     eachADDRESS_LINE_2, eachADDRESS_LINE_3, eachADDRESS_LINE_4, eachADDRESS_LINE_5, eachPOSTCODE, eachREASON_FOR_REMOVAL,
  //     eachREASON_FOR_REMOVAL_EFFECTIVE_FROM_DATE, eachDATE_OF_DEATH, eachTELEPHONE_NUMBER, eachMOBILE_NUMBER,
  //     eachEMAIL_ADDRESS, eachPREFERRED_LANGUAGE, eachIS_INTERPRETER_REQUIRED, eachAction
  // } = arr;

  // outputObj = {
  //     NHS_NUMBER: eachNHS_NUMBER,
  //     SUPERSEDED_BY_NHS_NUMBER: eachSUPERSEDED_BY_NHS_NUMBER,
  //     PRIMARY_CARE_PROVIDER: eachPRIMARY_CARE_PROVIDER,
  //     GP_CONNECT: eachGP_CONNECT,
  //     NAME_PREFIX: eachNAME_PREFIX,
  //     GIVEN_NAME: eachGIVEN_NAME,
  //     OTHER_GIVEN_NAMES: eachOTHER_GIVEN_NAMES,
  //     FAMILY_NAME: eachFAMILY_NAME,
  //     DATE_OF_BIRTH: eachDATE_OF_BIRTH,
  //     GENDER: eachGENDER,
  //     ADDRESS_LINE_1: eachADDRESS_LINE_1,
  //     ADDRESS_LINE_2: eachADDRESS_LINE_2,
  //     ADDRESS_LINE_3: eachADDRESS_LINE_3,
  //     ADDRESS_LINE_4: eachADDRESS_LINE_4,
  //     ADDRESS_LINE_5: eachADDRESS_LINE_5,
  //     POSTCODE: eachPOSTCODE,
  //     REASON_FOR_REMOVAL: eachREASON_FOR_REMOVAL,
  //     REASON_FOR_REMOVAL_EFFECTIVE_FROM_DATE: eachREASON_FOR_REMOVAL_EFFECTIVE_FROM_DATE,
  //     DATE_OF_DEATH: eachDATE_OF_DEATH,
  //     TELEPHONE_NUMBER: eachTELEPHONE_NUMBER,
  //     MOBILE_NUMBER: eachMOBILE_NUMBER,
  //     EMAIL_ADDRESS: eachEMAIL_ADDRESS,
  //     PREFERRED_LANGUAGE: eachPREFERRED_LANGUAGE,
  //     IS_INTERPRETER_REQUIRED: eachIS_INTERPRETER_REQUIRED,
  //     Action: eachAction
  // }
  // return outputObj
}

async function run() {
  try {
    let healthCheck = await handShake({
      url: MESH_URL,
      mailboxID: MESH_SENDER_MAILBOX_ID,
      mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      sharedKey: MESH_SHARED_KEY,
      agent: config.senderAgent
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
      url: MESH_URL,
      mailboxID: MESH_SENDER_MAILBOX_ID,
      mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      sharedKey: MESH_SHARED_KEY,
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
      url: MESH_URL,
      mailboxID: MESH_SENDER_MAILBOX_ID,
      mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      sharedKey: MESH_SHARED_KEY,
      messageFile: inputData,
      mailboxTarget: MESH_SENDER_MAILBOX_ID,
      agent: config.senderAgent,
    });

    console.log(messageChunk.data);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function markRead(msgID) {
  const config = await loadConfig();
  try {
    let markMsg = await markAsRead({
      url: MESH_URL,
      mailboxID: MESH_SENDER_MAILBOX_ID,
      mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      sharedKey: MESH_SHARED_KEY,
      message: msgID,
      agent: config.senderAgent,
    });

    console.log(markMsg.data);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function readMsg(msgID) {
  const config = await loadConfig();
  try {
    let messages = await readMessage({
      url: MESH_URL,
      mailboxID: MESH_SENDER_MAILBOX_ID,
      mailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
      sharedKey: MESH_SHARED_KEY,
      messageID: msgID,
      agent: config.senderAgent,
    });
    const messageData = messages.data;
    // console.log(messageData);

    const meshArr = await processData(messageData, callback);
    return meshArr;

    //mark message as read once file is created (do a conditional check)
    // markRead(msgID);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log("Succeeded");
    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};
//END OF FUNCTIONS

//HANDLER
export const handler = async (event, context) => {
  let finalMsgArr = [];
  const bucketName = `${ENVIRONMENT}-galleri-caas-data`;
  try {
    console.log('healthy test');
    let healthy = await run();
    // console.log('abdul' + healthy);
    // if (healthy === 200) {
    //   console.log(`Status ${healthy}`);
    //   let messageArr = await runMessage();
    //   if (messageArr.length > 0) {
    //     for (let i = 0; i < messageArr.length; i++) {
    //       let message = await readMsg(messageArr[i]);
    //       finalMsgArr.push(message);
    //       // console.log(message);
    //     }
    //   } else {
    //     console.log('No Messages');
    //   }
    // } else { //TODO: check connection to mesh, certs may be incorrect
    //   console.log('Failed to establish connection');
    // }
    // console.log(finalMsgArr);
  } catch (error) {
    console.error("Error occurred:", error);
  }

  //TODO: need to chunk data and replace finalMsgArr
  try {
    const dateTime = new Date(Date.now()).toISOString();

    const filename = `mesh_chunk_data_${dateTime}`;
    await pushCsvToS3(
      bucketName,
      `galleri-caas-data/${filename}.csv`,
      finalMsgArr,
      s3
    );
  } catch (e) {
    console.error("Error writing MESH data to bucket: ", e);
  }
};




