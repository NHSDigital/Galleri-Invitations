import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const dbClient = new DynamoDBClient({ convertEmptyValues: true });
const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * Reads a CSV file from S3.
 *
 * @async
 * @function readCsvFromS3
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the object in the S3 bucket.
 * @param {S3Client} client Instance of S3 client
 * @throws {Error} Failed to read from ${bucketName}/${key}
 * @returns {string} The data of the file you retrieved
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
 * Parses a CSV string into an array of objects.
 *
 * @function parseCsvToArray
 * @async
 * @param {string} csvString - The CSV string to parse.
 * @returns {Promise<Array<Object>>} Resolves to an array of parsed CSV records.
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
 * Saves new or updates existing GP practice records to the GpPractice table.
 *
 * @function saveArrayToTable
 * @async
 * @param {Array} dataArray - Array of csv objects.
 * @param {string} environment - Name of environment.
 * @param {DynamoDBClient} client - Dynamodb client.
 * @returns {Promise<void>} Promise resolves when all updates resolve
 */
export const saveArrayToTable = async (dataArray, environment, client) => {
  console.log(`Populating database table`);
  const dateTime = new Date(Date.now()).toISOString();
  return Promise.all(
    dataArray.map(async (item) => {
      const lsoa = await getItemFromTable(
        item["Postcode"],
        environment,
        client
      );
      const params = {
        Key: {
          gp_practice_code: {
            S: item["Code"],
          },
        },
        ExpressionAttributeNames: {
          "#ICB": "icb_id",
          "#NAME": "gp_practice_name",
          "#ADDRESS1": "address_line_1",
          "#ADDRESS2": "address_line_2",
          "#ADDRESS3": "address_line_3",
          "#ADDRESS4": "address_line_4",
          "#ADDRESS5": "address_line_5",
          "#POSTCODE": "postcode",
          "#TELEPHONE": "telephone_number",
          "#OPEN": "open_date",
          "#CLOSE": "close_date",
          "#LSOA": "LSOA_2011",
          "#UPDATED": "last_updated_date_time",
        },
        ExpressionAttributeValues: {
          ":icb": {
            S: item["High Level Health Geography Code"],
          },
          ":name": {
            S: item["Name"],
          },
          ":address1": {
            S: item["Address Line 1"],
          },
          ":address2": {
            S: item["Address Line 2"],
          },
          ":address3": {
            S: item["Address Line 3"],
          },
          ":address4": {
            S: item["Town"],
          },
          ":address5": {
            S: item["County"],
          },
          ":telephone": {
            S: item["Contact Telephone Number"],
          },
          ":postcode": {
            S: item["Postcode"],
          },
          ":start": {
            S: item["Legal Start Date"],
          },
          ":close": {
            S: item["Legal End Date"],
          },
          ":lsoa": {
            S: lsoa ? lsoa.LSOA_2011.S : "",
          },
          ":updated": {
            S: dateTime,
          },
        },
        TableName: `${environment}-GpPractice`,
        UpdateExpression:
          "set #ICB = :icb, #NAME = :name, #ADDRESS1 = :address1, #ADDRESS2 = :address2, #ADDRESS3 = :address3, #ADDRESS4 = :address4, #ADDRESS5 = :address5, #POSTCODE = :postcode, #TELEPHONE = :telephone, #OPEN = :start, #CLOSE = :close, #LSOA = :lsoa, #UPDATED = :updated",
      };
      const command = new UpdateItemCommand(params);
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode !== 200) {
        console.error(`Error inserted item: ${JSON.stringify(item)}`);
      }
    })
  );
};

/**
 * Gets lsoa from the Postcode table for a postcode key value
 *
 * @async
 * @function getItemFromTable
 * @param {string} key Postcode primary key value
 * @param {string} environment Environment name of the table
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @returns {Object} Object with the postcode lsoa if found
 */
export const getItemFromTable = async (key, environment, client) => {
  const getParams = {
    TableName: `${environment}-Postcode`,
    Key: {
      POSTCODE: {
        S: key,
      },
    },
    ConsistentRead: true,
    ProjectionExpression: "LSOA_2011",
  };
  const getCommand = new GetItemCommand(getParams);
  const response = await client.send(getCommand);
  return response.Item;
};

/**
 * Lambda handler
 *
 * @async
 * @function handler
 * @param {Object} event S3 put event trigger
 * @returns {string} Success message
 * @throws {Error} Error with failure message
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
    await saveArrayToTable(dataArray, ENVIRONMENT, dbClient);
    console.log(`Finished processing object ${key} in bucket ${bucket}`);
    return `Finished processing object ${key} in bucket ${bucket}`;
  } catch (err) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};
