//IMPORTS
import { getSecret } from "./helper.js"
import { handShake, loadConfig, getMessageCount, readMessage, markAsRead } from "nhs-mesh-client";
import { S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const clientS3 = new S3Client({});


const ENVIRONMENT = process.env.ENVIRONMENT;

const GTMS_MESH_CERT = await readSecret("GTMS_MESH_CERT", smClient);
const MESH_GTMS_KEY = await readSecret("MESH_SENDER_KEY", smClient);


//HANDLER
export const handler = async (event, context) => {

};


//FUNCTIONS
async function readSecret(secretName, client) {
  return Buffer.from(
    await getSecret(secretName, client),
    "base64"
  ).toString("utf8");
}
//END OF FUNCTIONS
