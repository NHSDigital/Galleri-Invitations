import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import csv from 'csv-parser';

const GALLERI_ONS_BUCKET_NAME = process.env.BUCKET_NAME
const LSOA_FILE_KEY = "lsoa_data_2023-08-15T15:42:13.301Z.csv"

export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    }));

    return response.Body.transformToString();
  } catch (err) {
      console.log('Failed: ', err);
      throw err;
    }
};

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
    }));

    console.log('Succeeded');
    return response;
  } catch (err) {
    console.log('Failed: ', err);
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
        dataArray.push(row)
        if (row_counter === 250000) {
          resolve(dataArray )
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map(element => Object.values(element).join(","))
  ].join("\n");
};

export const handler = async () => {
  const bucketName = GALLERI_ONS_BUCKET_NAME;
  const key = LSOA_FILE_KEY;
  const client = new S3Client({})



  try {
    const csvString = await readCsvFromS3(bucketName, key, client);
    const dataArray = await parseCsvToArray(csvString);

    const nonProdLsoaDataString = generateCsvString(
      `POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE`,
      dataArray
    );
    const dateTime = new Date(Date.now()).toISOString();

    const filename = `non_prod_lsoa_data_${dateTime}`

    await pushCsvToS3(bucketName, `non_prod_lsoa_data_/${filename}.csv`, nonProdLsoaDataString, client);

  } catch (e) {
    console.error(e)
  }
}
