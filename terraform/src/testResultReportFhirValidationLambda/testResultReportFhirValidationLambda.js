import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
const ENVIRONMENT = process.env.ENVIRONMENT;
let validationServiceUrl;

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    validationServiceUrl = await getSecret(process.env.FHIR_VALIDATION_SERVICE_URL, smClient);
    const testResultReport = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);
    await processTRR(testResultReport, key, bucket, s3);
  } catch (error) {
    console.error("Error: Issue occurred whilst processing JSON file from S3");
    console.error("Error:", error);
  }
};

//FUNCTIONS
export async function processTRR(testResultReport, reportName, originalBucket, s3) {
  const validTRR = await validateTRR(testResultReport, reportName, validationServiceUrl);
  if (validTRR) {
    await putTRRInS3Bucket(testResultReport, reportName, TRR_SUCCESSFUL_BUCKET, s3);
  } else {
    await putTRRInS3Bucket(testResultReport, reportName, TRR_UNSUCCESSFUL_BUCKET, s3);
  };
  await deleteTRRinS3Bucket(reportName, originalBucket, s3);
};

// Validate TRR
export async function validateTRR(testResultReport, reportName, validationServiceUrl) {
  try {
    const response = await axios({
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      data: JSON.stringify(testResultReport),
      url: `${validationServiceUrl}/FHIR/R4/$validate`,
    });

    if (!responseHasErrors(response.data, reportName)) {
      console.log(`FHIR validation successful for ${reportName}`);
      return true;
    } else {
      console.error(`Error: FHIR validation unsuccessful for ${reportName} - Status ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.response) {
      console.error(`Error: Unsuccessful request to FHIR validation service for ${reportName} - Status ${error.response.status} - Error body: ${error.response.data}`);
    } else {
      console.error(`Error: Unsuccessful request to FHIR validation service for ${reportName} - : Error: ${error.message}`);
    }
    return false;
  }
};

// Move TRR to S3 bucket
export async function putTRRInS3Bucket(testResultReport, reportName, bucketName, client) {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: `${ENVIRONMENT}-${bucketName}`,
        Key: reportName,
        Body: JSON.stringify(testResultReport),
      })
    );
    console.log(`Successfully pushed to ${bucketName}/${reportName}`);
    return response;
  } catch (err) {
    console.error(
      `Error: Failed to push to ${bucketName}/${reportName}. Error Message: ${err}`
    );
    throw err;
  }
};

export async function deleteTRRinS3Bucket(reportName, bucketName, client) {
  try {
    const response = await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: reportName,
      })
    );

    console.log(`Successfully deleted ${reportName} from ${bucketName}`);
    return response;
  } catch (error) {
    console.error(`Error: deleting ${reportName} from ${bucketName}: ${error}`);
    throw error;
  }
};

export function responseHasErrors(response, reportName) {
  const issues = response.issue;
  let hasError = false;

  for (const issue of issues) {
    if (issue.severity === "error") {
      console.error(`Error: FHIR diagnostic message for ${reportName} : ${issue.diagnostics}`);
      hasError = true;
    }
  }

  return hasError;
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
    console.error(`Error: Failed to get object key ${key} from bucket ${bucketName}`);
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
    console.error(`Error: Failed to retrieve ${secretName}`);
    throw error;
  }
};
