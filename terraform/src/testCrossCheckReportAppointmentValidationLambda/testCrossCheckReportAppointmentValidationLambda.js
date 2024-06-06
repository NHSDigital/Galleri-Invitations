import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

import get from "lodash.get";
//VARIABLES
const s3 = new S3Client();
const CR_TRR_SUCCESSFUL_BUCKET = process.env.CR_TRR_SUCCESSFUL_BUCKET;
const CR_TRR_UNSUCCESSFUL_BUCKET = process.env.CR_TRR_UNSUCCESSFUL_BUCKET;
const ENVIRONMENT = process.env.ENVIRONMENT;
const dbClient = new DynamoDBClient();

let fhirPayload = {
  Grail_Id: "",
  Participant_Id: "",
  Blood_Collection_Date: "",
};
//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const js = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);
    //Extract ParticipantID, GrailID, BloodCollectionDate fields
    extractFHIRMessage(js);
    //bring back most recent appointment, with timestamp
    const sortedApptParticipants = await getLastAppointment();
    let isValidTRR = false;
    if (sortedApptParticipants.length > 0) {
      const appointmentParticipantItems = sortedApptParticipants[0];
      isValidTRR = await validateTRR(fhirPayload, appointmentParticipantItems);
    }

    await processTRR(js, key, bucket, s3, isValidTRR);
  } catch (error) {
    console.error("Error: Issue occurred whilst processing JSON file from S3");
    console.error("Error:", error);
  }
};

/**
 * Extracts the ParticipantID, GrailID, BloodCollectionDate fields from a FHIR message JSON object.
 * @function processIncomingRecords
 * @param {Object} js - The JSON object containing the FHIR message.
 */
function extractFHIRMessage(js) {
  for (let objs in js.entry) {
    //Grail_Id
    if (get(js.entry[objs].resource, `resourceType`) === "ServiceRequest") {
      fhirPayload.Grail_Id = get(
        js.entry[objs].resource.identifier[0],
        `value`
      );
    }
    //Participant_Id
    if (get(js.entry[objs].resource, `resourceType`) === "Patient") {
      fhirPayload.Participant_Id = get(
        js.entry[objs],
        `resource.identifier[0].value`
      );
    }
    //Blood Collection Date
    if (get(js.entry[objs].resource, `resourceType`) === "Specimen") {
      fhirPayload.Blood_Collection_Date = get(
        js.entry[objs].resource,
        `collection.collectedDateTime`
      );
    }
  }
}

/**
 * Retrieves the most recent appointment with its timestamp.
 * @async
 * @function getLastAppointment
 * @returns {Array} A promise that resolves to an object containing the most recent appointment and its timestamp.
 */
export async function getLastAppointment() {
  const appointmentParticipant = await lookUp(
    dbClient,
    fhirPayload.Participant_Id,
    "Appointments",
    "Participant_Id",
    "S",
    false
  ); //Check participant has any appointments

  let sortedApptParticipants = [];
  if (appointmentParticipant != null) {
    const apptArr = appointmentParticipant?.Items;
    sortedApptParticipants = apptArr?.sort(function (x, y) {
      return new Date(x?.["Timestamp"]?.["S"]) <
        new Date(y?.["Timestamp"]?.["S"])
        ? 1
        : -1;
    });
  }
  return sortedApptParticipants;
}

/**
 * Validated the FHIR message with appointment participant Items and depending on outcome put it into the correct s3 bucket.
 * @async
 * @function processTRR
 * @param {Object} js FHIR message as a JSON object
 * @param {string} reportName Name of the test report file
 * @param {string} originalBucket Name of originating bucket
 * @param {Object} s3 An instance of an S3 client
 * @param {boolean} isValidTRR valid/invalid TRR
 */
export async function processTRR(
  js,
  reportName,
  originalBucket,
  s3,
  isValidTRR
) {
  if (isValidTRR) {
    await putTRRInS3Bucket(js, reportName, CR_TRR_SUCCESSFUL_BUCKET, s3);
  } else {
    await putTRRInS3Bucket(js, reportName, CR_TRR_UNSUCCESSFUL_BUCKET, s3);
    console.error(
      "Error: Re-identification Fails move TRR to the Step 3 validated unsuccessful bucket"
    );
  }
  await deleteTRRinS3Bucket(reportName, originalBucket, s3);
}

/**
 * Validated the FHIR message with appointment participant Items and depending on outcome put it into the correct s3 bucket.
 * @async
 * @function validateTRR
 * @param {Object} fhirPayload FHIR message as a JSON object
 * @param {Object} appointmentParticipantItems most recent appointment, with timestamp
 * @returns {boolean} A promise that resolves to true if the validation is successful, otherwise false.
 */
export async function validateTRR(fhirPayload, appointmentParticipantItems) {
  if (
    appointmentParticipantItems?.Participant_Id.S ===
      fhirPayload.Participant_Id &&
    appointmentParticipantItems?.grail_id.S === fhirPayload.Grail_Id &&
    appointmentParticipantItems?.blood_collection_date.S ===
      fhirPayload.Blood_Collection_Date
  ) {
    console.log(`Move TRR to the 'Step 3 validated successfully bucket`);
    return true;
  } else {
    console.log(`Move TRR to the 'Step 3 validated unsuccessful bucket`);
    return false;
  }
}

// Move TRR to S3 bucket
/**
 * Put FHIR message in an S3 bucket
 * @async
 * @function putTRRInS3Bucket
 * @param {Object} js FHIR message to be put in a bucket
 * @param {string} reportName Name of the FHIR message file
 * @param {string} bucketName Name of the S3 bucket to be used
 * @param {S3Client} s3Client An instance of an S3 client
 * @returns {Object} Response from the S3 send command
 * @throws {Error} Error pushing TRR to S3 bucket
 */
export async function putTRRInS3Bucket(js, reportName, bucketName, s3Client) {
  try {
    const response = await s3Client.send(
      new PutObjectCommand({
        Bucket: `${ENVIRONMENT}-${bucketName}`,
        Key: reportName,
        Body: JSON.stringify(js),
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
}

/**
 * Delete TRR from Step 2 validated successfully bucket
 * @async
 * @function deleteTRRinS3Bucket
 * @param {string} reportName Test result report to be deleted from a bucket
 * @param {string} bucketName Name of the S3 bucket to be used
 * @param {S3Client} s3Client An instance of an S3 client
 * @returns {Object} Response from the S3 send command
 * @throws {Error} Error deleting TRR from S3 bucket
 */
export async function deleteTRRinS3Bucket(reportName, bucketName, s3Client) {
  try {
    const response = await s3Client.send(
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
}

/**
 * Retrieve and parse the JSON file
 * @async
 * @function retrieveAndParseJSON
 * @param {Function} getJSONFunc Function to retrieve a JSON file from a bucket
 * @param {string} bucket Name of bucket
 * @param {string} key Object key
 * @param {S3Client} s3Client An Instance of an S3 client
 * @returns {Object} Parsed JSON object
 */
export const retrieveAndParseJSON = async (
  getJSONFunc,
  bucket,
  key,
  s3Client
) => {
  const JSONMsgStr = await getJSONFunc(bucket, key, s3Client);
  return JSON.parse(JSONMsgStr);
};

/**
 * Get JSON file from the bucket
 * @async
 * @function getJSONFromS3
 * @param {string} bucketName Name of bucket
 * @param {string} key Object key
 * @param {S3Client} s3Client An Instance of an S3 s3Client
 * @returns {string} Body of file transformed into a string
 * @throws {Error} Failed to get object from S3
 */
export async function getJSONFromS3(bucketName, key, s3Client) {
  console.log(`Getting object key ${key} from bucket ${bucketName}`);
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(`Finished getting object key ${key} from bucket ${bucketName}`);
    return response.Body.transformToString();
  } catch (err) {
    console.error(
      `Error: Failed to get object key ${key} from bucket ${bucketName}`
    );
    console.error("Error:", err);
    throw err;
  }
}

/**
 * This function allows the user to query against DynamoDB.
 * @async
 * @function lookUp
 * @param {Object} dbClient Instance of DynamoDB client
 * @param  {...any} params params is destructed to id, which is the value you use to query against.
 * The table is the table name (type String), attribute is the column you search against (type String),
 * attributeType is the type of data stored within that column and useIndex is toggled to true if you want to use
 * an existing index (type boolean)
 * @returns {Object} metadata about the response, including httpStatusCode
 */
export const lookUp = async (dbClient, ...params) => {
  const [id, table, attribute, attributeType, useIndex] = params;

  const ExpressionAttributeValuesKey = `:${attribute}`;
  let expressionAttributeValuesObj = {};
  let expressionAttributeValuesNestObj = {};

  expressionAttributeValuesNestObj[attributeType] = id;
  expressionAttributeValuesObj[ExpressionAttributeValuesKey] =
    expressionAttributeValuesNestObj;

  const input = {
    ExpressionAttributeValues: expressionAttributeValuesObj,
    KeyConditionExpression: `${attribute} = :${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) {
    input.IndexName = `${attribute}-index`;
  }

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.$metadata.httpStatusCode != 200) {
    console.log(`look up item input = ${JSON.stringify(input, null, 2)}`);
  }

  return response;
};
