import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { validate } from "jsonschema";
import json from "./clinic-schema.json" assert { type: "json" };

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const jsonString = await readFromS3(bucket, key, s3);
    const validationResults = await validateRecord(JSON.parse(jsonString),client); //need parse as s3 resolves as string

    console.log(`Finished validating object ${key} in bucket ${bucket}`);
    console.log('----------------------------------------------------------------');

    //Timestamp
    const timeNow = Date.now();

    console.log(`Pushing filtered valid records and invalid records to their respective sub-folder in bucket ${bucket}`);

    // Valid Records Arrangement
    if (validationResults.success) {
      // Deposit to S3 bucket
      await pushToS3(bucket, `validRecords/valid_records_add-${timeNow}.json`, jsonString, s3);
    }
    else {
      await pushToS3(bucket, `invalidRecords/invalid_records-${timeNow}.json`, jsonString, s3);
      console.warn("PLEASE FIND THE INVALID Clinic RECORDS FROM THE PROCESSED Clinic Data BELOW:\n" + validationResult.errors, null, 2);
    }
    return `Finished validating object ${key} in bucket ${bucket}`;

  } catch (err) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  };
};


export const readFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    return response.Body.transformToString();
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const pushToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export async function validateRecord(record, client) {
  const validationResults = {
    success: true,
    message: "success",
  };

  console.log("record:", record);

  const validation = validate(record, json);
  if (validation.valid) {
    // validate the JSON Schema
   const postcodeValidation = await isPostcodeInGridall(record.ClinicCreateOrUpdate.Postcode, client);
    if (postcodeValidation.hasOwnProperty("Item")) {
      // AC - not covered Postcode provided (if supplied)
      const ICBValidation = postcodeValidation.Item.ICB.S ;
      if (!isValidICBCode(ICBValidation)) {
        // AC - not covered ICB code provided (if supplied)
        validationResults.success = false;
        validationResults.message = `Invalid ICB Code : ${ICBValidation}`;
        return validationResults;
      }
    }
    else {
      validationResults.success = false;
      validationResults.message = `Invalid PostCode : ${record.ClinicCreateOrUpdate.Postcode}`;
      console.log("Postcode does not exists in Gridall:", record.ClinicCreateOrUpdate.Postcode);
      return validationResults;
    }
  }
  else {
    validationResults.success = false;
    validationResults.message = "Invalid JSON";
    console.error("errors : ", validation.errors);
    return validationResults;
  }
  return validationResults;
}

export const isPostcodeInGridall = async(key, client) => {
  //AC - Check if Postcode exists in the Postcode DynamoDB Table
  const getParams = {
      "TableName": `${ENVIRONMENT}-Postcode`,
      "Key": {
          "POSTCODE": {
              "S": key
          }
      },
      "ConsistentRead": true,
      "ProjectionExpression": "ICB"
  };
  const getCommand = new GetItemCommand(getParams);
  const response = await client.send(getCommand);

  return response;
};

export function isValidICBCode(ICBCode) {
  // AC - check if it's one of the specified valid ICB codes
  const validICBCodes = [
    "QE1",
    "QWO",
    "QOQ",
    "QF7",
    "QHG",
    "QM7",
    "QH8",
    "QMJ",
    "QMF",
    "QRV",
    "QWE",
    "QT6",
    "QJK",
    "QOX",
    "QUY",
    "QVV",
    "QR1",
    "QSL",
    "QRL",
    "QU9",
    "QNQ",
    "QXU",
    "QNX",
  ];
  return validICBCodes.includes(ICBCode);
}
