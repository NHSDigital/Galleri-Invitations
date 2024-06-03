import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
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

/**
 * Lambda handler to process an upload user accounts csv file.
 * @function handler
 * @async
 * @param {Object} event - S3 event notification.
 * @returns {string} Message that processing completed successfully.
 * @throws {Error} Processing error.
 */
export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const dataArray = await parseCsvToArray(csvString);
    validateData(dataArray);
    await saveArrayToTable(dataArray, ENVIRONMENT, dbClient);
    console.log(`Finished processing object ${key} in bucket ${bucket}`);
    return `Finished processing object ${key} in bucket ${bucket}`;
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};

/**
 * Validates the UUID, Status, Role, Name and Email Address fields in
 * each user account object.
 * @function validateData
 * @param {Array} dataArray - Array of user account csv objects.
 * @throws {Error} Validation error.
 */
export const validateData = (dataArray) => {
  console.log(`Validating data`);
  for (let i = 0; i < dataArray.length; i++) {
    const item = dataArray[i];
    let errorMsg;
    if (!regexUuid.test(item["UUID"])) {
      errorMsg = `Invalid UUID ${item["UUID"]}`;
    }
    else if (!regexStatus.test(item["Status"])) {
      errorMsg = `Invalid Status for ${item["UUID"]}`;
    }
    else if (!regexRole.test(item["Role"])) {
      errorMsg = `Invalid Role for ${item["UUID"]}`;
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

/**
 * Saves new or updates existing user accounts to the UserAccounts table.
 * @function saveArrayToTable
 * @async
 * @param {Array} dataArray - Array of user account csv objects.
 * @param {string} environment - Name of environment.
 * @param {DynamoDBClient} client - Dynamodb client.
 * @returns {Promise}
 */
export const saveArrayToTable = async (dataArray, environment, client) => {
  console.log(`Populating database table`);
  const dateTime = new Date(Date.now()).toISOString();
  return Promise.all(
    dataArray.map(async (item) => {
      const uuid = item["UUID"];
      const userAccountResponse = await lookUp(
        client,
        uuid,
        "UserAccounts",
        "User_UUID",
        "S",
        false
      );
      const existingAccount = userAccountResponse.Items?.[0];

      const params = {
        Key: {
          User_UUID: {
            S: uuid,
          },
        },
        ExpressionAttributeNames: {
          "#NAME": "Name",
          "#EMAIL": "Email",
          "#STATUS": "Status",
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
          ":role": {
            S: item["Role"],
          },
          ":updated": {
            S: dateTime,
          },
        },
        TableName: `${environment}-UserAccounts`,
        UpdateExpression:
          "set #NAME = :name, #EMAIL = :email, #STATUS = :status, #ROLE = :role, #UPDATED = :updated",
      };
      if (!existingAccount) {
        console.log(`Adding new user account: ${uuid}`);
        params.ExpressionAttributeNames["#CREATED"] = "Creation_DateTime";
        params.ExpressionAttributeValues[":created"] = { S: dateTime };
        params.UpdateExpression = `${params.UpdateExpression} , #CREATED = :created`;
      } else {
        console.log(`Updating user account: ${uuid}`);
      }

      const command = new UpdateItemCommand(params);
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode !== 200) {
        console.error(`Error: updating user account for uuid ${uuid}`);
      }
    })
  );
};

/**
 * Parses a csv string to an array of user account csv objects.
 * @function parseCsvToArray
 * @async
 * @param {string} csvString - Csv string.
 * @returns {Promise}
 */
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

/**
 * Reads an S3 object.
 * @function readCsvFromS3
 * @async
 * @param {string} bucketName - S3 bucket name.
 * @param {string} key - S3 object key.
 * @param {S3Client} client - S3 client.
 * @returns {string} S3 object content string.
 * @throws {Error}
 */
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

/**
 * Queries a table item.
 * @function lookUp
 * @async
 * @param {DynamoDBClient} dbClient - Dynamodb client.
 * @param {string} id - Item attribute value.
 * @param {string} table - Table name.
 * @param {string} attribute - Item attribute name.
 * @param {string} attributeType - Item attribute type.
 * @param {boolean} useIndex - use index for attribute.
 * @returns {Object} Query response.
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
