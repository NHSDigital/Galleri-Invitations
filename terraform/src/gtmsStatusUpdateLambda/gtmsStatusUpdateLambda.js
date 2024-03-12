//IMPORTS
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  GetItemCommand,
  ScanCommand,
  BatchWriteItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";

//VARIABLES
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    console.log(csvString);
    // const js = JSON.parse(csvString);
    // console.log(`js variable: , ${js}`);

    // const PERSON_ID = ;
    // const result = await getItemsFromTable(
    //   `${ENVIRONMENT}-Population`,
    //   client,
    //   PERSON_ID,
    // );
  } catch (error) {
    console.error("Error occurred:", error);
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

export async function getItemsFromTable(table, client, key) {
  const params = {
    Key: {
      PersonId: {
        N: `${key}`,
      },
    },
    TableName: table,
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  return response;
}
