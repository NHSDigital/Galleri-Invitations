//IMPORTS
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

//VARIABLES
const ENVIRONMENT = process.env.ENVIRONMENT;
const GALLERI_ONS_BUCKET_NAME = process.env.BUCKET_NAME;
const LSOA_FILE_KEY = process.env.KEY;

/**
 * Reads a CSV file from an S3 bucket and returns its content as a string.
 *
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<string>} The content of the CSV file as a string.
 * @throws {Error} If there is an error reading the object from S3.
 */
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
    console.log("Failed: ", err);
    throw err;
  }
};

/**
 * Pushes a CSV file to an S3 bucket.
 *
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {string|Array} body - The content to be uploaded.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<Object>} The response from the S3 client.
 * @throws {Error} If there is an error uploading the object to S3.
 */
export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log("Succeeded");
    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

/**
 * Parses a CSV string into an array of objects.
 *
 * @async
 * @param {string} csvString - The CSV string to be parsed.
 * @returns {Promise<Object[]>} An array of objects representing the CSV data.
 * @throws {Error} If there is an error parsing the CSV string.
 */
export const parseCsvToArray = async (csvString) => {
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
 * Generates a CSV string from a header and an array of data objects.
 *
 * @param {string} header - The CSV header.
 * @param {Object[]} dataArray - An array of objects representing the data.
 * @returns {string} The generated CSV string.
 */
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

/**
 * Lambda handler to process a CSV file from S3, generate a subset of the data, and upload the subset back to S3.
 *
 * @function handler
 * @async
 * @returns {Promise<void>}
 */
export const handler = async () => {
  const bucketName = `${ENVIRONMENT}-${GALLERI_ONS_BUCKET_NAME}`;
  const key = LSOA_FILE_KEY;
  const client = new S3Client({});
  let nonProdLsoaDataString = "";

  try {
    const csvString = await readCsvFromS3(bucketName, key, client);
    const dataArray = await parseCsvToArray(csvString);

    nonProdLsoaDataString = generateCsvString(
      `POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE`,
      dataArray.splice(0, 250000)
    );
  } catch (e) {
    console.error("Error reading LSOA file from bucket: ", e);
  }

  try {
    const dateTime = new Date(Date.now()).toISOString();

    const filename = `non_prod_lsoa_data_${dateTime}`;
    await pushCsvToS3(
      bucketName,
      `non_prod_lsoa_data_/${filename}.csv`,
      nonProdLsoaDataString,
      client
    );
  } catch (e) {
    console.error("Error writing LSOA subset file to bucket: ", e);
  }
};
