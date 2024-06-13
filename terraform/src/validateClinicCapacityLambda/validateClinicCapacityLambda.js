import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { validate } from "jsonschema";
import ClinicSchemaGTMS from "./clinic-schema.json" assert { type: "json" };
import { isMonday } from "date-fns";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });
const SIX_WEEK_HORIZON = 6;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const jsonString = await readFromS3(bucket, key, s3);
    let validationResult = {};

    try {
        validationResult = await validateRecord(
        JSON.parse(jsonString),
        client
        );
      } catch (error) {
        console.error(`Error: Failed to validate record with error: ${error.message}`);
        validationResult.success = false;
      }
      console.log(`Finished validating object ${key} in bucket ${bucket}`);

      // Valid Records Arrangement
      if (validationResult.success) {
      console.log(
        `Pushing valid record to ${bucket}/validRecords/${key}`
      );
      // Deposit to S3 bucket
      await pushToS3(
        `${ENVIRONMENT}-processed-inbound-gtms-clinic-schedule-summary`,
        `validRecords/${key}`,
        jsonString,
        s3
      );
    } else {
      if(validationResult.message) {
        console.warn(
          "PLEASE FIND THE INVALID Clinic RECORDS FROM THE PROCESSED Clinic Capacity BELOW:\n" +
            validationResult.message
        );
      }
      if(validationResult.message) {
        console.error(`Error: ${validationResult.message}`);
      }
      console.log(
        `Pushing invalid record to ${ENVIRONMENT}-processed-inbound-gtms-clinic-schedule-summary/invalidRecords/${key}`
      );
      await pushToS3(
        `${ENVIRONMENT}-processed-inbound-gtms-clinic-schedule-summary`,
        `invalidRecords/${key}`,
        jsonString,
        s3
      );
    }
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};


/**
 * Read object from S3 bucket
 *
 * @function readFromS3
 * @async
 * @param {string} bucketName Name of bucket.
 * @param {string} key Key for object in bucket.
 * @param {S3Client} client Instance of an S3 client
 * @returns {Promise<string>} String response from get object command.
 */
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
    console.error("Error: ", err);
    throw err;
  }
};

/**
 * Push object to S3
 *
 * @function pushToS3
 * @async
 * @param {string} bucketName Name of bucket to send object to.
 * @param {string} key Key of the object to be sent.
 * @param {string} body Body of the object to be sent.
 * @param {S3Client} client Instance of an S3 client.
 * @returns {Promise<Object>} Response from the put object command.
 */
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
    console.error("Error: ", err);
    throw err;
  }
};

/**
 * Validate clinic capacity record
 *
 * @function validateRecord
 * @async
 * @param {Object} record Record to be validated.
 * @param {DynamoDBClient} client Instance of a DynamoDB client.
 * @returns {Promise<Object>} Validation results.
 */
export async function validateRecord(record, client) {
  const validationResults = {
    success: true,
    message: "success",
  };

  console.log("record:", JSON.stringify(record));

  const numberOfClinics =
    record.ClinicScheduleSummary.ClinicScheduleSummary.length;
  let count = 0;

  while (count < numberOfClinics) {
    const validClinic = await isClinicIDvalid(
      record.ClinicScheduleSummary.ClinicScheduleSummary[count].ClinicID,
      client
    );

    if (validClinic) {
      const validation = validate(record, ClinicSchemaGTMS);
      if (!validation.valid) {
        // validate the JSON Schema
        validationResults.success = false;
        validationResults.message = `Invalid JSON Schema`;
        console.error("Error: ", validation.errors);
        return validationResults;
      } else {
        record.ClinicScheduleSummary.ClinicScheduleSummary.forEach((clinic) => {
          if (clinic.Schedule.length !== SIX_WEEK_HORIZON) {
            validationResults.success = false;
            validationResults.message =
              "Six week horizon is exceeded or not met";
            return validationResults;
          } else {
            clinic.Schedule.forEach((scheduleElement) => {
              if (!isMonday(new Date(scheduleElement.WeekCommencingDate))) {
                validationResults.success = false;
                validationResults.message =
                  "Week Commencing Date is not a Monday";
                return validationResults;
              }
            });
          }
        });
      }
    } else {
      validationResults.success = false;
      validationResults.message = `Invalid ClinicID: ${record.ClinicScheduleSummary.ClinicScheduleSummary[count].ClinicID}`;
      return validationResults;
    }
    count++;
  }
  return validationResults;
}

export async function isClinicIDvalid(record, client) {

  if (record === undefined || record === "") {
    console.error('Error: ClinicID value is undefined');
    return false;
  } else {
    const input = {
      ExpressionAttributeValues: {
        ":ClinicId": {
          S: `${record}`,
        },
      },
      KeyConditionExpression: "ClinicId = :ClinicId",
      ProjectionExpression: "ClinicName",
      TableName: `${ENVIRONMENT}-PhlebotomySite`,
    };

    const command = new QueryCommand(input);
    const response = await client.send(command);

    if (response.Count === 1) {
      return true;
    } else {
      return false;
    }
  }
}
