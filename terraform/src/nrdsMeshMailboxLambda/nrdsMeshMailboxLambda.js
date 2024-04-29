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
//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});

const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event, context) => {
  const CONFIG = await loadConfig({
    // url: process.env.K8_URL,
    url: "test",
    TestKey: process.env.MESH_SHARED_KEY,
    sandbox: "true",
    // senderMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
    // senderMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
    receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
    receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
  });

  const HANDSHAKE = handShake;
  const MSG_COUNT = getMessageCount;
  const MARKED = markAsRead;
  const READING_MSG = readMessage;

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
            const dateTime = new Date(Date.now()).toISOString();
            let message = await readMsg(CONFIG, READING_MSG, element); //returns messages based on id, iteratively from message list arr
            console.log(message);
            console.log(typeof message);
            const response = await pushCsvToS3(
              `${ENVIRONMENT}-processed-nrds-data`,
              `record_${dateTime}.json`,
              JSON.stringify(message["data"]),
              clientS3
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
