//IMPORTS
import {
  getSecret,
  pushCsvToS3,
  getHealthStatusCode,
  getMessageArray,
  markRead,
  readMsg,
} from "./helper.js";
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
//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});

const ENVIRONMENT = process.env.ENVIRONMENT;
const FILE_PATH = process.env.FILE_OUTPUT_PATH;
const FILE_EXTENSION = process.env.FILE_EXTENSION;

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
  //Required for TDD approach
  const workflows = {
    CLINIC_WORKFLOWID: process.env.CLINIC_WORKFLOW,
    CLINIC_SCHEDULE_WORKFLOWID: process.env.CLINIC_SCHEDULE_WORKFLOW,
    APPOINTMENT_WORKFLOWID: process.env.APPOINTMENT_WORKFLOW,
    WITHDRAW_WORKFLOWID: process.env.WITHDRAW_WORKFLOW,
  };

  try {
    console.log("Establishing connection");
    let healthy = await getHealthStatusCode(CONFIG, HANDSHAKE);
    let keepProcessing = true;
    if (healthy === 200) {
      console.log(`Status: ${healthy}`);

      while (keepProcessing) {
        let messageArr = await getMessageArray(CONFIG, MSG_COUNT); //return arr of message ids
        console.log(`messageArr: ${messageArr}`);
        if (messageArr.length > 0) {
          for (const element of messageArr) {
            let message = await readMsg(CONFIG, READING_MSG, element); //returns messages based on id, iteratively from message list arr
            const data = fs.readFileSync(
              `${FILE_PATH}/${msgID}.${FILE_EXTENSION}`
            );
            const response = await processMessage(
              message,
              JSON.parse(data),
              ENVIRONMENT,
              clientS3,
              workflows
            );
            if (response?.$metadata?.httpStatusCode === 200) {
              const confirmation = await markRead(CONFIG, MARKED, element);
              console.log(`${confirmation.status} ${confirmation.statusText}`);
            } else {
              console.log(`Failed to process this message`);
            }
          }
        } else {
          console.log("No messages to process");
          keepProcessing = false;
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

//FUNCTIONS
export async function readSecret(secretName, client) {
  return Buffer.from(await getSecret(secretName, client), "base64").toString(
    "utf8"
  );
}

/*
 * Processing incoming messages from GTMS (MESH mailbox)
 * @params timestamp can be changed for testing fixed time values
 * The outbound-gtms-invited-participant-batch bucket is not included here as it is
 * an outbound bucket, where GPS will be sending info to GTMS
 */
export async function processMessage(
  message,
  data,
  environment,
  S3client,
  workflows,
  timestamp
) {
  const dateTime = timestamp || new Date(Date.now()).toISOString();
  if (
    message.initial_response?.["headers"]?.["mex-workflowid"] ===
    workflows.CLINIC_WORKFLOWID
  ) {
    //Deposit to S3, ClinicCreateOrUpdate
    const confirmation = await pushCsvToS3(
      `${environment}-inbound-gtms-clinic-create-or-update`,
      `clinic_create_or_update_${dateTime}.json`,
      JSON.stringify(data),
      S3client
    );
    return confirmation;
  }

  if (
    message.initial_response?.["headers"]?.["mex-workflowid"] ===
    workflows.CLINIC_SCHEDULE_WORKFLOWID
  ) {
    //Deposit to S3, ClinicScheduleSummary
    const confirmation = await pushCsvToS3(
      `${environment}-inbound-gtms-clinic-schedule-summary`,
      `clinic_schedule_summary_${dateTime}.json`,
      JSON.stringify(data),
      S3client
    );
    return confirmation;
  }

  if (
    message.initial_response?.["headers"]?.["mex-workflowid"] ===
    workflows.APPOINTMENT_WORKFLOWID
  ) {
    //Deposit to S3, Appointment
    const confirmation = await pushCsvToS3(
      `${environment}-inbound-gtms-appointment`,
      `appointment_${dateTime}.json`,
      JSON.stringify(data),
      S3client
    );
    return confirmation;
  }

  if (
    message.initial_response?.["headers"]?.["mex-workflowid"] ===
    workflows.WITHDRAW_WORKFLOWID
  ) {
    //Deposit to S3, Withdrawal
    const confirmation = await pushCsvToS3(
      `${environment}-inbound-gtms-withdrawal`,
      `withdrawal_${dateTime}.json`,
      JSON.stringify(data),
      S3client
    );
    return confirmation;
  }

  if (
    message.initial_response?.["headers"]?.["mex-workflowid"] !==
    (workflows.CLINIC_WORKFLOWID &&
      workflows.CLINIC_SCHEDULE_WORKFLOWID &&
      workflows.APPOINTMENT_WORKFLOWID &&
      workflows.WITHDRAW_WORKFLOWID)
  ) {
    //Deposit invalid record S3
    const confirmation = await pushCsvToS3(
      `${environment}-invalid-gtms-payload`,
      `invalid_gtms_record_${dateTime}.json`,
      JSON.stringify(data),
      S3client
    );
    return confirmation;
  }
}
//END OF FUNCTIONS
