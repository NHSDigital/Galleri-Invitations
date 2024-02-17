// import { getSecret, pushToS3 } from "./helper.js"
import { handShake, loadConfig, sendMessage, readMessage } from "nhs-mesh-client";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  //inside handler so they do not need to be mocked globally
  //retrieve secrets into lambda, certificates required to connect to MESH
  const MESH_SENDER_CERT = await readSecret("MESH_SENDER_CERT", smClient);
  const MESH_SENDER_KEY = await readSecret("MESH_SENDER_KEY", smClient);
  const MESH_RECEIVER_CERT = await readSecret("MESH_RECEIVER_CERT", smClient);
  const MESH_RECEIVER_KEY = await readSecret("MESH_RECEIVER_KEY", smClient);
  const CONFIG = await loadConfig({
    url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
    sharedKey: process.env.MESH_SHARED_KEY,
    sandbox: "false",
    senderCert: MESH_SENDER_CERT,
    senderKey: MESH_SENDER_KEY,
    senderMailboxID: process.env.MESH_SENDER_MAILBOX_ID,
    senderMailboxPassword: process.env.MESH_SENDER_MAILBOX_PASSWORD,
    receiverCert: MESH_RECEIVER_CERT,
    receiverKey: MESH_RECEIVER_KEY,
    receiverMailboxID: process.env.MESH_RECEIVER_MAILBOX_ID,
    receiverMailboxPassword: process.env.MESH_RECEIVER_MAILBOX_PASSWORD,
  });


  try {
    const JSONMsg = await getJSONFromS3(bucket, key, s3);
    console.log("JSON Message", JSONMsg);
    // await sendUncompressed(JSONMsg);
    // await sendToS3();

  } catch (error) {
    console.error("Error occurred:", error);
  }
};


//FUNCTIONS

//Get JSON File from the bucket
async function getJSONFromS3(bucketName, key, client) {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(response.Body);
    console.log(typeof (response.Body));
    console.log(response.Body.transformToString());


    return response.Body;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
}

//Send Message based on the MailBox ID from the config
async function sendUncompressed(msg) {
  try {
    let healthCheck = await handShake({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });

    if (healthCheck.status != 200) {
      log.error(`Health Check Failed: ${healthCheck}`);
      process.exit(1);
    }

    let message = await sendMessage({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      message: msg,
      mailboxTarget: config.receiverMailboxID,
      agent: config.senderAgent,
    });

    if (message.status != 202) {
      log.error(`Create Message Failed: ${message.status}`);
      process.exit(1);
    }
  } catch (error) {
    log.error("An error occurred:", error.message);
    process.exit(1);
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
    console.log("Failed: ", error);
    throw error;
  }
}

async function readSecret(secretName, client) {
  return Buffer.from(
    await getSecret(secretName, client),
    "base64"
  ).toString("utf8");
}
//END OF FUNCTIONS

