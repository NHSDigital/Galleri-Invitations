import { checkDynamoTable } from './helper/insertRecords'
import { handShake, loadConfig, getMessageCount, sendMessageChunks, readMessage, markAsRead } from "nhs-mesh-client";
import { Readable } from "stream"
import csv from "csv-parser";
import dotenv from "dotenv";
import fs from "fs";

//VARIABLES
const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.ENVIRONMENT;

const inputData = "/Users/abduls/repos/newProj/input/galleri_cohort_test_data_small.csv"

const result = dotenv.config();
if (result.error) {
  throw result.error;
}

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
  const config = await loadConfig();
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

async function runMessage() {
  const config = await loadConfig();
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

async function sendMsg(msg) {
  const config = await loadConfig();
  try {
    let messageChunk = await sendMessageChunks({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      messageFile: inputData,
      mailboxTarget: config.senderMailboxID,
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
  const config = await loadConfig();
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
    // console.log(messageData);

    const meshArr = await processData(messageData, callback);
    return meshArr;

    //mark message as read once file is created (do a conditional check)
    // markRead(msgID);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
//END OF FUNCTIONS

//HANDLER
export const handler = async (event, context) => {
  try {
    let healthy = await run();
    if (healthy === 200) {
      console.log(`Status ${healthy}`);
      let messageArr = await runMessage();
      if (messageArr.length > 0) {
        for (let i = 0; i < messageArr.length; i++) {
          let message = await readMsg(messageArr[i]);
          console.log(message);
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






const checkIcbCode = checkDynamoTable(dbClient, primarCareProviderCode, "GpPractice", "primarCareProviderCode", false)
const checkSupersededByNhsNo = checkDynamoTable(dbClient, supersededByNhsNo, "Population", "supersededByNhsNo", true)
const checkNhsNo = checkDynamoTable(dbClient, nhsNo, "Population", "nhsNo", true)
