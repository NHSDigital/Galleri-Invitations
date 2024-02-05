import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand, ScanCommand, } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    // console.log(event);
    const csvString = await readCsvFromS3(bucket, key, s3);
    console.log(csvString);
    console.log(typeof csvString);
    const js = JSON.parse(csvString);
    console.log(typeof js); //obj
    console.log(js); //
    // {
    //   ClinicCreateOrUpdate: {
    //     ClinicID: 'C1C-A1A',
    //     ODSCode: 'Y888888',
    //     ICBCode: 'QNX',
    //     ClinicName: 'GRAIL Test Clinic',
    //     Address: '210 Euston Rd, London NW1 2DA',
    //     Postcode: 'BD22 0AG',
    //     Directions: 'Closest London Underground station is Euston Square.'
    //   }
    // }

    const result = await getItemsFromTable(
      `${ENVIRONMENT}-PhlebotomySite`,
      client
    );
    const itemList = result.items

    for (const element of itemList) {
      // if (js.ClinicCreateOrUpdate.ClinicID === element.ClinicId){
      if ("BH48C920" === element.ClinicId.S) {
        console.log(true);
      }
    }


  } catch (error) {
    console.error("Error occurred:", error);
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
    console.log(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};


export async function getItemsFromTable(table, client) {
  const response = await client.send(
    new ScanCommand({
      TableName: table,
    })
  );

  return response;
}
