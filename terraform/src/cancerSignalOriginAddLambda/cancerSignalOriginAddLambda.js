import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import csv from "csv-parse";
import { Readable } from "stream";

const s3 = new S3Client();
const dbClient = new DynamoDBClient({
  region: "eu-west-2",
  convertEmptyValues: true,
});
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const cancerSignalOrigins = await parseCsvToArray(csvString);
    await batchWriteCancerSignalOriginTable(dbClient, cancerSignalOrigins);
  } catch (error) {
    console.error(
      "Error: failed with cancer signal origin extraction, processing, or uploading",
      error
    );
  }
};

// METHODS
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
    console.error(`Error: Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

export const parseCsvToArray = async (csvString) => {
  return new Promise((resolve, reject) => {
    const dataArray = [];
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
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

// DYNAMODB FUNCTIONS
export async function batchWriteCancerSignalOriginTable(
  client,
  cancerSignalOrigins,
  table = `${ENVIRONMENT}-CancerSignalOrigin`
) {
  const batchSize = 25; // DynamoDB batch write limit
  const batches = [];

  for (let i = 0; i < cancerSignalOrigins.length; i += batchSize) {
    const batch = cancerSignalOrigins.slice(i, i + batchSize);
    const putRequests = batch.map((item) => ({
      PutRequest: {
        Item: {
          Participant_Id: { S: item.Participant_Id },
          Cso_Result_Snomed_Code_Sorted: {
            S: item.Cso_Result_Snomed_Code_Sorted,
          },
          Grail_Prd_Version: { S: item.Grail_Prd_Version },
          Grail_Code: { S: item.Grail_Code },
          Grail_Heading: { S: item.Grail_Heading },
          Grail_Subheading: { S: item.Grail_Subheading },
          Cso_Result_Snomed_Code_And_Preferred_Term: {
            S: item.Cso_Result_Snomed_Code_And_Preferred_Term,
          },
          Cso_Result_Friendly: { S: item.Cso_Result_Friendly },
          Created_By: { S: item.Created_By },
          Start_Date: { S: "Date Now" },
          End_Date: { S: "End date" },
        },
      },
    }));

    batches.push({
      RequestItems: {
        [table]: putRequests,
      },
    });
  }

  const results = await Promise.all(
    batches.map((batch) => client.send(new BatchWriteItemCommand(batch)))
  );

  results.forEach((result, index) => {
    if (result.$metadata.httpStatusCode !== 200) {
      console.error(
        `Error: Batch ${index + 1} failed with status code ${
          result.$metadata.httpStatusCode
        }`
      );
    }
  });
}
