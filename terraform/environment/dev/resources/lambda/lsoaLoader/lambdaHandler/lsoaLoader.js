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

export const handler = async () => {
  const bucketName = GALLERI_ONS_BUCKET_NAME;
  const client = new S3Client({})

  try {


  } catch (e) {
    console.error(e)
  }
}
