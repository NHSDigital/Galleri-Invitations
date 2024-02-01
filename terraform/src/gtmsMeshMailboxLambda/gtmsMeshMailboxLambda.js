//IMPORTS
import { getSecret, pushCsvToS3, run, getMessageArray, markRead, readMsg } from "./helper.js"
import { handShake, loadConfig, getMessageCount, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});


const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event, context) => {

  //inside handler so they do not need to be mocked globally
  const GTMS_MESH_CERT = await readSecret("GTMS_MESH_CERT", smClient);
  const MESH_GTMS_KEY = await readSecret("MESH_SENDER_KEY", smClient);
  const HANDSHAKE = handShake;
  const MSG_COUNT = getMessageCount;
  const MARKED = markAsRead;
  const READING_MSG = readMessage;
  const CONFIG = await loadConfig({
    url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
    sharedKey: process.env.MESH_SHARED_KEY,
    sandbox: "false",
    senderCert: GTMS_MESH_CERT,
    senderKey: MESH_GTMS_KEY,
    senderMailboxID: process.env.GTMS_MESH_MAILBOX_ID,
    senderMailboxPassword: process.env.GTMS_MESH_MAILBOX_PASSWORD,
    receiverCert: GTMS_MESH_CERT,
    receiverKey: MESH_GTMS_KEY,
    receiverMailboxID: process.env.GTMS_MESH_MAILBOX_ID,
    receiverMailboxPassword: process.env.GTMS_MESH_MAILBOX_PASSWORD,
  });

  try {
    console.log('Establishing connection');
    let healthy = await run(CONFIG, HANDSHAKE);
    if (healthy === 200) {
      console.log(`Status: ${healthy}`);
      let messageArr = await getMessageArray(CONFIG, MSG_COUNT); //return arr of message ids
      console.log(`messageArr: ${messageArr}`);
      if (messageArr.length > 0) {
        for (const element of messageArr) {
          let message = await readMsg(CONFIG, READING_MSG, element); //returns messages based on id, iteratively from message list arr
          const response = await processMessage(message, ENVIRONMENT, clientS3);
          if (response.$metadata.httpStatusCode === 200) {
            const confirmation = await markRead(CONFIG, MARKED, element);
            console.log(`${confirmation.status} ${confirmation.statusText}`);
          };
        }
      } else {
        console.log("No messages to process");
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};


//FUNCTIONS
export async function readSecret(secretName, client) {
  return Buffer.from(
    await getSecret(secretName, client),
    "base64"
  ).toString("utf8");
}

/*
 * Processing incoming messages from GTMS (MESH mailbox)
 * @params timestamp can be changed for testing fixed time values
 * The outbound-gtms-invited-participant-batch bucket is not included here as it is
 * an outbound bucket, where GPS will be sending info to GTMS
 */
export async function processMessage(message, environment, S3client, timestamp) {
  const dateTime = timestamp || new Date(Date.now()).toISOString()
  if (message?.ClinicCreateOrUpdate) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-clinic-create-or-update`,
      `clinic_create_or_update_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.ClinicScheduleSummary) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-clinic-schedule-summary`,
      `clinic_schedule_summary_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.Appointment) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-appointment`,
      `appointment_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }

  if (message?.Withdrawal) {
    //Deposit to S3
    const confirmation = await pushCsvToS3(
      `${environment}-gtms-withdrawal`,
      `withdrawal_${dateTime}.json`,
      JSON.stringify(message),
      S3client
    );
    return confirmation;
  }
}
//END OF FUNCTIONS
