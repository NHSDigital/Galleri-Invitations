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
    console.log(`js.entry ${js.entry}`);
    for (let objs in js.entry) {
      //Grail_Id
      if (get(js.entry[objs].resource, `resourceType`) === "Specimen") {
        fhirPayload.Grail_Id = get(
          js.entry[objs].resource.identifier[0],
          `value`
        );
      }

      console.log(`fhirPayload.Grail_Id ${fhirPayload.Grail_Id}`);
      //Blood Collection Date
      //Participant_Id
      if (get(js.entry[objs].resource, `resourceType`) === "Patient") {
        fhirPayload.Participant_Id = get(
          js.entry[objs],
          `resource.identifier[0].value`
        );
      }
      console.log(`Participant_Id ${fhirPayload.Participant_Id}`);

      if (get(js.entry[objs].resource, `resourceType`) === "Specimen") {
        fhirPayload.Blood_Collection_Date = get(
          js.entry[objs].resource,
          `collection.collectedDateTime`
        );
      }
      console.log(
        `fhirPayload.Blood_Collection_Date ${fhirPayload.Blood_Collection_Date}`
      );
    }

    //bring back most recent appointment, with timestamp
    const sortedApptParticipants = await getLastAppointment();
    const isValidTRR = false;
    console.log(
      `sortedApptParticipants 0 ? ${JSON.stringif(sortedApptParticipants)}`
    );
    if (sortedApptParticipants !== null) {
      console.log(
        `sortedApptParticipants 1 ? ${JSON.stringif(sortedApptParticipants)}`
      );
      const appointmentParticipantItems = sortedApptParticipants[0];
      isValidTRR = await validateTRR(appointmentParticipantItems);
      console.log(`isValidTRR 0 ? ${isValidTRR}`);
    }

    console.log(`isValidTRR ? ${isValidTRR}`);
    await processTRR(js, key, bucket, s3, isValidTRR);
  } catch (error) {
    console.error("Error: Issue occurred whilst processing JSON file from S3");
    console.error("Error:", error);
  }
};

//bring back most recent appointment, with timestamp
export async function getLastAppointment() {
  const appointmentParticipant = await lookUp(
    dbClient,
    fhirPayload.Participant_Id,
    "Appointments",
    "Participant_Id",
    "S",
    false
  ); //Check participant has any appointments
  const apptArr = appointmentParticipant?.Items;
  const sortedApptParticipants = apptArr?.sort(function (x, y) {
    return new Date(x?.["Timestamp"]?.["S"]) < new Date(y?.["Timestamp"]?.["S"])
      ? 1
      : -1;
  });
  return sortedApptParticipants;
}

//process TRR
export async function processTRR(
  js,
  reportName,
  originalBucket,
  s3,
  isValidTRR
) {
  if (isValidTRR) {
    console.log(`isValidTRR true ${isValidTRR}`);
    await putTRRInS3Bucket(js, reportName, CR_TRR_SUCCESSFUL_BUCKET, s3);
  } else {
    console.log(`putTRRInS3Bucket`);
    console.log(`isValidTRR false ${isValidTRR}`);
    await putTRRInS3Bucket(js, reportName, CR_TRR_UNSUCCESSFUL_BUCKET, s3);
  }
  console.log(`deleteTRRinS3Bucket`);
  await deleteTRRinS3Bucket(reportName, originalBucket, s3);
}

// Validate TRR
export async function validateTRR(appointmentParticipantItems) {
  console.log(
    `appointmentParticipantItems 0 ? ${JSON.stringif(
      appointmentParticipantItems
    )}`
  );
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
    console.log(`Move TRR to the 'Step 3 validated unsuccessful bucket1`);
    return false;
  }
}

// Move TRR to S3 bucket
export async function putTRRInS3Bucket(js, reportName, bucketName, client) {
  onsole.log(`Move TRR to S3 bucket ${bucketName}/${reportName}`);
  try {
    const response = await client.send(
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
}

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
    console.error(
      `Error: Failed to get object key ${key} from bucket ${bucketName}`
    );
    console.error("Error:", err);
    throw err;
  }
}

/**
 * This function allows the user to query against DynamoDB.
 *
 * @param {Object} dbClient Instance of DynamoDB client
 * @param  {...any} params params is destructed to id, which is the value you use to query against.
 * The table is the table name (type String), attribute is the column you search against (type String),
 * attributeType is the type of data stored within that column and useIndex is toggled to true if you want to use
 * an existing index (type boolean)
 * @returns {Object} metadata about the request, including httpStatusCode
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
