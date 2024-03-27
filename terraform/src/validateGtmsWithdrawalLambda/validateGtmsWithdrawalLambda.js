//IMPORTS
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { validate } from "jsonschema";
import schema from "./GTMS-withdrawal-schema.json" assert { type: "json" };

//VARIABLES
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const jsonString = await readCsvFromS3(bucket, key, s3);
    const validateResult = validate(JSON.parse(jsonString), schema); //convert string retrieved from S3 to object

    console.log(`Finished validating object ${key} in bucket ${bucket}`);
    console.log(
      "----------------------------------------------------------------"
    );

    console.log(
      `Pushing filtered valid records and invalid records to their respective sub-folder in bucket ${bucket}`
    );
    console.log(validateResult.valid);

    if (validateResult.valid) {
      await pushCsvToS3(
        `${ENVIRONMENT}-processed-inbound-gtms-withdrawal`,
        `validRecords/valid_records_add-${Date.now()}.json`,
        jsonString,
        s3
      );
    } else {
      console.warn(
        "PLEASE FIND THE INVALID Clinic RECORDS FROM THE PROCESSED Clinic Data BELOW:\n" +
        validateResult.errors,
      );
      await pushCsvToS3(
        `${ENVIRONMENT}-processed-inbound-gtms-withdrawal`,
        `failed_validation/invalid_records_add-${Date.now()}.json`,
        jsonString,
        s3
      );
    }
  } catch (err) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};


//FUNCTIONS
export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return response.Body.transformToString();
  } catch (err) {
    console.error(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log(`Failed to push to ${bucketName}/${key}. Error Message: ${err}`);
    throw err;
  }
};
