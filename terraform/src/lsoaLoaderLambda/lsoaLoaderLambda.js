import {
  ListObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const ENVIRONMENT = process.env.environment;

const GALLERI_ONS_BUCKET_NAME = process.env.BUCKET_NAME;
const LSOA_FILE_KEY = process.env.KEY;

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

export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

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
