//IMPORTS
import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  GetItemCommand,
  // ScanCommand,
  // BatchWriteItemCommand,
  // UpdateItemCommand,
  QueryCommand,
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
    console.log(typeof csvString);
    const js = JSON.parse(csvString); //convert string retrieved from S3 to object
    console.log(typeof js);
    console.log(js);


    const PERSON_ID = js?.['Withdrawal']?.['ParticipantID'];
    console.log(PERSON_ID); //NHS-AC35-BS33

    const value = await lookupParticipantId(PERSON_ID, 'Episode', client, ENVIRONMENT);
    console.log(value);
    const searching = await lookupParticipant(PERSON_ID, 'Population', client, ENVIRONMENT);
    console.log(searching);

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
      Participant_Id: {
        S: `${key}`,
      },
    },
    TableName: table,
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  return response;
}

export const lookupParticipantId = async (participantId, table, dbClient, environment) => {
  console.log("Looking up participant: ", participantId);
  const input = {
    ExpressionAttributeValues: {
      ":participant": {
        S: `${participantId}`,
      },
    },
    KeyConditionExpression: "Participant_Id = :participant",
    ProjectionExpression: "Participant_Id",
    TableName: `${environment}-${table}`,
    IndexName: "Participant_Id-index",
  };

  const command = new QueryCommand(input);
  const response = await dbClient.send(command);
  if (!response.Items.length || response.$metadata.httpStatusCode !== 200) { // if response is empty, no matching participantId
    return false;
  }
  console.log('match');
  return true;
};

export const lookupParticipant = async (participantId, table, dbClient, environment) => {
  console.log("Looking up participant: ", participantId);
  const param = {
    ExpressionAttributeValues: {
      ":id": {
        S: participantId,
      },
    },
    KeyConditionExpression: "PersonId = :id",
    Limit: 1,
    ProjectionExpression: "participantId",
    TableName: `${environment}-${table}`
  };

  const command = new QueryCommand(param);
  const response = await dbClient.send(command);

  if (!response.Items.length || response.$metadata.httpStatusCode !== 200) { // if response is empty, no matching participantId
    return false;
  } else {
    console.log('match');
    return true;
  }
};
