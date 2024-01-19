import { handShake, loadConfig, getMessageCount, sendMessageChunks, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from "stream"
import csv from "csv-parser";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { Upload } from "@aws-sdk/lib-storage";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});


const ENVIRONMENT = process.env.ENVIRONMENT;
// const MESH_SANDBOX = process.env.MESH_SANDBOX;
// const MESH_URL = process.env.MESH_URL;

let meshSenderCert = Buffer.from(
  await getSecret("MESH_SENDER_CERT"),
  "base64"
).toString("utf8");
let meshSenderKey = Buffer.from(
  await getSecret("MESH_SENDER_KEY"),
  "base64"
).toString("utf8");
let meshReceiverCert = Buffer.from(
  await getSecret("MESH_RECEIVER_CERT"),
  "base64"
).toString("utf8");
let meshReceiverKey = Buffer.from(
  await getSecret("MESH_RECEIVER_KEY"),
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


// const MESH_CA = process.env.MESH_CA;
// const MESH_SHARED_KEY = process.env.MESH_SHARED_KEY_1;
// const MESH_SENDER_MAILBOX_ID = process.env.MESH_SENDER_MAILBOX_ID;
// const MESH_SENDER_MAILBOX_PASSWORD = process.env.MESH_SENDER_MAILBOX_PASSWORD;
// const MESH_RECEIVER_MAILBOX_ID = process.env.MESH_RECEIVER_MAILBOX_ID;
// const MESH_RECEIVER_MAILBOX_PASSWORD = process.env.MESH_RECEIVER_MAILBOX_PASSWORD;
// const MESH_RECEIVER_KEY = process.env.MESH_RECEIVER_KEY;
// const MESH_RECEIVER_CERT = process.env.MESH_RECEIVER_CERT;
// const MESH_SENDER_KEY = process.env.MESH_SENDER_KEY;
// const MESH_SENDER_CERT = process.env.MESH_SENDER_CERT;
// const MESH_TEST = await getSecret("MESH_TEST");


// const MESH_CA = await getSecret("MESH_CA");
// const MESH_RECEIVER_KEY = await getSecret("MESH_RECEIVER_KEY");
// const MESH_RECEIVER_CERT = await getSecret("MESH_RECEIVER_CERT");
// const MESH_SENDER_KEY = await getSecret("MESH_SENDER_KEY");
// const MESH_SENDER_CERT = await getSecret("MESH_SENDER_CERT");

// process.env.MESH_CA = MESH_CA_SM;
// process.env.MESH_RECEIVER_KEY = MESH_RECEIVER_KEY_SM;
// process.env.MESH_RECEIVER_CERT = MESH_RECEIVER_CERT_SM;
// process.env.MESH_SENDER_CERT = MESH_SENDER_CERT_SM;
// process.env.MESH_SENDER_KEY = MESH_SENDER_KEY_SM;


// const config = await loadConfig();

// const senderAgent = new Agent({
//   cert: Buffer.from(MESH_SENDER_CERT, "base64").toString(
//     "utf8"
//   ),
//   key: Buffer.from(MESH_SENDER_KEY, "base64").toString("utf8"),
//   rejectUnauthorized: false,
// })





//can remove, for testing purposes only
// const inputData = "/Users/abduls/repos/newProj/input/galleri_cohort_test_data_small.csv"


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

export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
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
  // console.log(response);
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

    // const meshArr = await processData(messageData, callback);
    // const header = "nhs_number,superseded_by_nhs_number,primary_care_provider,gp_connect,name_prefix,given_name,other_given_names,family_name,date_of_birth,gender,address_line_1,address_line_2,address_line_3,address_line_4,address_line_5,postcode,reason_for_removal,reason_for_removal_effective_from_date,date_of_death,telephone_number,mobile_number,email_address,preferred_language,is_interpreter_required,action";

    // const meshString = await generateCsvString(header, meshArr);
    return messageData;
    // return messageData;
    //mark message as read once file is created (do a conditional check)
    // markRead(msgID);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

//generator function yields chunkSegment when desired size is reached
const chunking = function* (itr, size, header) {
  let chunkSegment = [header];
  let tempStr = header;
  for (const val of itr) {
    tempStr += "\n";
    tempStr += val;
    chunkSegment.push(val);
    if (chunkSegment.length === size) {
      yield tempStr;
      chunkSegment = [header];
      tempStr = header;
    }
  }
  if (chunkSegment.length) yield tempStr;
};//make it reusable by allowing header to be set


export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key, //filename
        Body: body,
      })
    );

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

async function multipleUpload(chunk, client) {
  // let dateTime = new Date(Date.now()).toISOString();
  // let filename = `mesh_chunk_data_${dateTime}`;
  let count = 0;
  return Promise.all(
    chunk.map(async (x) => {
      count++;
      console.log(count);
      let dateTime = new Date(Date.now()).toISOString();
      let filename = `mesh_chunk_data_${count}_${dateTime}`;
      let response = await (pushCsvToS3(
        `${ENVIRONEMNT}-galleri-caas-data`,
        `${filename}.csv`,
        x,
        client
      )).then(console.log("hello"));
      console.log(response);
      if (response.$metadata.httpStatusCode !== 200) {
        console.error("Error uploading item ");
      }
    }))
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
    multipleUpload(chunk, clientS3)
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



