import { S3Client, GetObjectCommand, DataRedundancy } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const dbClient = new DynamoDBClient({ convertEmptyValues: true });
const ENVIRONMENT = process.env.ENVIRONMENT;

const regexUuid = /^[0-9]{4} [0-9]{4} [0-9]{4}$/;
const regexStatus = /^Inactive$|^Active$/;
const regexRole = /^Invitation Planner$|^Referring Clinician$|^Invitation Planner \- Support$|^Referring Clinician \- Support$/;
const regexName = /^[a-zA-Z][a-zA-Z 0-9\-]*$/;
const regexEmail = /^[a-zA-Z][a-zA-Z@_0-9\.\-]+$/;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const dataArray = await parseCsvToArray(csvString);
    await validateData(dataArray);
    await saveArrayToTable(dataArray, ENVIRONMENT, dbClient);
    console.log(`Finished processing object ${key} in bucket ${bucket}`);
    return `Finished processing object ${key} in bucket ${bucket}`;
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};

export const validateData = (dataArray) => {
  for (let i = 0; i < dataArray.length; i++) {
    const item = dataArray[i];
    let errorMsg;
    if (!regexUuid.test(item["UUID"])) {
      errorMsg = `Invalid UUID ${item["UUID"]}`;
    }
    else if (!regexStatus.test(item["Status"])) {
      errorMsg = `Invalid Status ${item["Status"]}`;
    }
    else if (!regexRole.test(item["Role"])) {
      errorMsg = `Invalid Role ${item["Role"]}`;
    }
    else if (!regexName.test(item["Name"])) {
      errorMsg = `Invalid Name for ${item["UUID"]}`;
    }
    else if (!regexEmail.test(item["Email Address"])) {
      errorMsg = `Invalid Email for ${item["UUID"]}`;
    }

    if (errorMsg) {
      // Fail whole file if any row has a validation error
      throw new Error(errorMsg);
    }
  }
};

export const saveArrayToTable = async (dataArray, environment, client) => {
  console.log(`Populating database table`);
  const dateTime = new Date(Date.now()).toISOString();
  return Promise.all(
    dataArray.map(async (item) => {
      const params = {
        Key: {
          UUID: {
            S: item["UUID"],
          },
        },
        ExpressionAttributeNames: {
          "#NAME": "Name",
          "#EMAIL": "Email",
          "#STATUS": "Status",
          "#START_DATE": "Start_Date",
          "#ROLE": "Role",
          "#UPDATED": "Last_Updated_DateTime",
        },
        ExpressionAttributeValues: {
          ":name": {
            S: item["Name"],
          },
          ":email": {
            S: item["Email Address"],
          },
          ":status": {
            S: item["Status"],
          },
          ":start_date": {
            S: item["Start Date"],
          },
          ":role": {
            S: item["Role"],
          },
          ":updated": {
            S: dateTime,
          },
        },
        TableName: `${environment}-UserAccounts`,
        UpdateExpression:
          "set #NAME = :name, #EMAIL = :email, #STATUS = :status, #START_DATE = :start_date, #ROLE = :role, #UPDATED = :updated",
      };
      const command = new UpdateItemCommand(params);
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode !== 200) {
        console.error(`Error updating item: ${JSON.stringify(item)}`);
      }
    })
  );
};

export const parseCsvToArray = async (csvString) => {
  console.log("Parsing csv string");
  const dataArray = [];
  let row_counter = 0;

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        row_counter++;
        dataArray.push(row);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const readCsvFromS3 = async (bucketName, key, client) => {
  console.log(`Reading object ${key} from bucket ${bucketName}`);
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    return response.Body.transformToString();
  } catch (err) {
    console.error(
      `Error reading object ${key} from bucket ${bucketName}: ${err}`
    );
    throw err;
  }
};
