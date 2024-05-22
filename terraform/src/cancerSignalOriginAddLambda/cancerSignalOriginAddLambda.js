import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
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
    const cancerSignalOrigin = JSON.parse(csvString);
    addCancerSignalOriginTable(dbClient, cancerSignalOrigin);
  } catch (error) {
    console.error(
      "Error: failed with cancer signal origin extraction, procession or uploading",
      error
    );
  }
};

//METHODS
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

//DYNAMODB FUNCTIONS
export async function addCancerSignalOriginTable(
  client,
  cancerSignalOrigin,
  table = `${ENVIRONMENT}-CancerSignalOrigin`
) {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = cancerSignalOrigin.participantID;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression:
      "SET Cso_Result_Snomed_Code_Sorted = :csoResultSnomedCodeSorted, Grail_Prd_Version = :grailPrdVersion, Grail_Code = :grailCode, Grail_Heading = :grailHeading, Grail_Subheading = :grailSubheading, Cso_Result_Snomed_Code_And_Preferred_Term = :csoResultSnomedCodeAndPreferredTerm	, Cso_Result_Friendly = :csoResultFriendly, Created_By = :createdBy, Start_Date = :startDate, End_Date = :endDate ",
    ExpressionAttributeValues: {
      ":csoResultSnomedCodeSorted": {
        S: cancerSignalOrigin.Cso_Result_Snomed_Code_Sorted,
      },
      ":grailPrdVersion": { S: cancerSignalOrigin.Grail_Prd_Version },
      ":grailCode": { S: cancerSignalOrigin.Grail_Code },
      ":grailHeading": { S: cancerSignalOrigin.Grail_Heading },
      ":grailSubheading": { S: cancerSignalOrigin.Grail_Subheading },
      ":csoResultSnomedCodeAndPreferredTerm": {
        S: cancerSignalOrigin.Cso_Result_Snomed_Code_And_Preferred_Term,
      },
      ":csoResultFriendly": { S: cancerSignalOrigin.Cso_Result_Friendly },
      ":createdBy": { S: cancerSignalOrigin.Created_By },
      ":startDate": { S: "Date Now" },
      ":endDate": { S: "End date" },
    },
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${partitionKeyValue}`);
  }
  return response.$metadata.httpStatusCode;
}
