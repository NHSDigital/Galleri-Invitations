import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import axios from "axios";

//VARIABLES
const s3 = new S3Client();
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const TRR_SUCCESSFUL_BUCKET = process.env.TRR_SUCCESSFUL_BUCKET;
const TRR_UNSUCCESSFUL_BUCKET = process.env.TRR_UNSUCCESSFUL_BUCKET;
const FHIR_VALIDATION_SERVICE_NAME = process.env.FHIR_VALIDATION_SERVICE_NAME
let fhirValidationServiceURL;

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    fhirValidationServiceURL = await getSecret(FHIR_VALIDATION_SERVICE_NAME, smClient);
    const testResultReport = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);
    await processTRR(testResultReport, key);
  } catch (error) {
    console.error("Error occurred whilst processing JSON file from S3");
    console.error("Error:", error);
  }
};

//FUNCTIONS
export async function processTRR(testResultReport, reportName) {
  const validTRR = await validateTRR(testResultReport, reportName);
};

// Validate TRR
export async function validateTRR(testResultReport, reportName) {
  await axios({
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    data: JSON.stringify(testResultReport),
    url: `${FHIR_VALIDATION_SERVICE_URL}/FHIR/R4/$validate`,
  }).then((response) => {
    console.log(`FHIR validation successful for ${reportName}`);
    return true;
  })
  .catch((error) => {
    if (error.response) {
      console.error(`Error: Unsuccessful request to FHIR validation service for ${reportName} - Status ${error.response.status} - Error body: ${error.response.data}`);
    } else if (error.request) {
      console.log(`Error: Unsuccessful request to FHIR validation service for ${reportName} - Error request: `, error.request);
    } else {
      console.log(`Error: Unsuccessful request to FHIR validation service for ${reportName} - due to issue with setting up request message: `, error.message);
    }
    return false;
  });
};

// Move TRR to S3 bucket
export async function putTRRInS3Bucket(testResultReport, bucketName) {

};

// Retrieve and Parse the JSON file
export const retrieveAndParseJSON = async (
  getJSONFunc,
  bucket,
  key,
  client
) => {
  const JSONMsgStr = await getJSONFunc(bucket, key, client);
  return JSON.parse(JSONMsgStr);
};

// Get JSON File from the bucket
export async function getJSONFromS3(bucketName, key, client) {
  console.log(`Getting object key ${key} from bucket ${bucketName}`);
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(`Finished getting object key ${key} from bucket ${bucketName}`);
    return response.Body.transformToString();
  } catch (err) {
    console.error(`Failed to get object key ${key} from bucket ${bucketName}`);
    console.error("Error:", err);
    throw err;
  }
}

//Return 'Secret value' from secrets manager by passing in 'Secret name'
export const getSecret = async (secretName, client) => {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log(`Failed: ${error}`);
    throw error;
  }
};
