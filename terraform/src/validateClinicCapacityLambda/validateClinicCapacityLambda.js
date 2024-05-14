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
      console.log(`Finished validating object ${key} in bucket ${bucket}`);
      console.log(
        "----------------------------------------------------------------"
      );
    } catch (error) {
      console.error(`Error: Failed to validate result with error: ${error.message}`);
      validationResult.success = false;
    }

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
      console.log(
        `Pushing invalid record to ${bucket}/invalidRecords/${key}`
      );
      await pushToS3(
        `${ENVIRONMENT}-processed-inbound-gtms-clinic-schedule-summary`,
        `invalidRecords/${key}`,
        jsonString,
        s3
      );
      if(validationResult.errors) {
        console.error(
          "Error: PLEASE FIND THE INVALID Clinic RECORDS FROM THE PROCESSED Clinic Capacity BELOW:\n" +
            validationResult.errors
        );
      }
    }
    console.log(`Finished validating object ${key} in bucket ${bucket}`);
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
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
    console.error("Error: ", err);
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
    console.error("Error: ", err);
    throw err;
  }
};

export async function validateRecord(record, client) {
  const validationResults = {
    success: true,
    message: "success",
  };

  console.log("record:", JSON.stringify(record));

  const numberOfClinics =
    record.ClinicScheduleSummary.ClinicScheduleSummary.length;
  console.log("length:", numberOfClinics);
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
