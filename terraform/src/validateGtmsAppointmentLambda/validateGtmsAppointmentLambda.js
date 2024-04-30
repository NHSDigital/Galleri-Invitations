import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { validate } from "jsonschema";
import schema from "./GTMS-schema.json" assert { type: "json" };

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  const dateTime = new Date(Date.now()).toISOString();
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const jsonString = await readS3(bucket, key, s3);
    const validateResult = validate(JSON.parse(jsonString), schema);

    console.log(`Finished validating object ${key} in bucket ${bucket}`);
    console.log(
      "----------------------------------------------------------------"
    );

    console.log(
      `Pushing filtered valid records and invalid records to their respective sub-folder in bucket ${bucket}`
    );
    console.log(validateResult.valid);

    if (validateResult.valid) {
      await pushS3(
        `${ENVIRONMENT}-inbound-gtms-appointment-validated`,
        `validRecords/valid_records_add-${dateTime}.json`,
        jsonString,
        s3
      );
    } else {
      console.warn(
        "PLEASE FIND THE INVALID Clinic RECORDS FROM THE PROCESSED Clinic Data BELOW:\n" +
          validateResult.errors,
        null,
        2
      );
      await pushS3(
        `${ENVIRONMENT}-inbound-gtms-appointment-validated`,
        `invalidRecords/invalid_records_add-${dateTime}.json`,
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

//METHODS
export const readS3 = async (bucket, key, client) => {
  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return result.Body.transformToString();
  } catch (err) {
    console.log("Failed to read S3: ", err);
    throw err;
  }
};

export const pushS3 = async (bucket, key, body, client) => {
  try {
    const result = await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
      })
    );
    return result;
  } catch (err) {
    console.log("Failed to push to S3: ", err);
    throw err;
  }
};
