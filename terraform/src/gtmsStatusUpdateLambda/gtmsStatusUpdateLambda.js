//IMPORTS
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

//VARIABLES
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

/**
 * AWS Lambda handler to process S3 events and update DynamoDB tables accordingly.
 *
 * @function handler
 * @async
 * @param {Object} event - The S3 event triggering the Lambda.
 * @param {Object} context - The context object provided by AWS Lambda.
 * @returns {Promise<Object|void>} - A promise that resolves with the response from pushCsvToS3 if a record is rejected - if episode or Participant ID does not exist on DB table, otherwise void.
 */
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const js = JSON.parse(csvString); //convert string retrieved from S3 to object

    const PERSON_ID = js?.["Withdrawal"]?.["ParticipantID"];
    const REASON = js?.["Withdrawal"]?.["Reason"];

    const retrievedBatchID = await lookupParticipantId(
      PERSON_ID,
      "Episode",
      client,
      ENVIRONMENT
    );
    const retrievedParticipantID = await lookupParticipant(
      PERSON_ID,
      "Population",
      client,
      ENVIRONMENT
    );
    const dateTime = new Date(Date.now()).toISOString();
    if (retrievedParticipantID) {
      if (retrievedBatchID) {
        //AC2: update episode record data
        await saveObjToEpisodeTable(
          csvString,
          ENVIRONMENT,
          client,
          retrievedBatchID,
          REASON,
          PERSON_ID
        );
      } else {
        //AC1c: Save rejected record folder: 'episode does not exist'
        const confirmation = await pushCsvToS3(
          `${bucket}`,
          `episode_does_not_exist/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        );
        return confirmation;
      }
    } else {
      //AC1b: Save rejected record folder: 'Participant Id does not exist'
      const confirmation = await pushCsvToS3(
        `${bucket}`,
        `participant_id_does_not_exist/invalidRecord_${dateTime}.json`,
        csvString,
        s3
      );
      return confirmation;
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

/**
 * Reads a CSV file from an S3 bucket and returns its content as a string.
 *
 * @function readCsvFromS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the CSV file in the S3 bucket.
 * @param {S3Client} client - An instance of the AWS S3 client.
 * @returns {Promise<string>} - A promise that resolves to the CSV file content as a string.
 * @throws {Error} If there is an error reading the CSV file from S3.
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
    console.error(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

/**
 * Pushes a CSV file to an S3 bucket.
 *
 * @function pushCsvToS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key for the CSV file in the S3 bucket.
 * @param {string} body - The content of the CSV file.
 * @param {S3Client} client - An instance of the AWS S3 client.
 * @returns {Promise<Object>} - A promise that resolves to the response from the S3 PutObject command.
 * @throws {Error} If there is an error pushing the CSV file to S3.
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

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log(
      `Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

/**
 * Looks up a participant ID in a specified DynamoDB table(episode Table) and retrieves the corresponding batch ID.
 *
 * @function lookupParticipantId
 * @async
 * @param {string} participantId - The participant ID to look up.
 * @param {string} table - The name of the DynamoDB table.
 * @param {DynamoDBClient} dbClient - An instance of the AWS DynamoDB client.
 * @param {string} environment - The environment name used as prefix for the DynamoDB table.
 * @returns {Promise<string>} - A promise that resolves to the batch ID if found, or an empty string if not found.
 * @throws {Error} If there is an error querying the DynamoDB table.
 */
export const lookupParticipantId = async (
  participantId,
  table,
  dbClient,
  environment
) => {
  console.log("Looking up participant: ", participantId);
  const input = {
    ExpressionAttributeValues: {
      ":participant": {
        S: `${participantId}`,
      },
    },
    KeyConditionExpression: "Participant_Id = :participant",
    ProjectionExpression: "Participant_Id, Batch_Id",
    TableName: `${environment}-${table}`,
    IndexName: "Participant_Id-index",
  };

  const command = new QueryCommand(input);
  const response = await dbClient.send(command);
  if (!response?.Items?.length || response.$metadata.httpStatusCode !== 200) {
    // if response is empty, no matching participantId
    console.log("no matches in Episode Table");
    return "";
  } else {
    console.log("A match in Episode Table");
    return response["Items"][0]["Batch_Id"]["S"];
  }
};

/**
 * Looks up a participant ID in a specified DynamoDB table(population Table).
 *
 * @function lookupParticipant
 * @async
 * @param {string} participantId - The participant ID to look up.
 * @param {string} table - The name of the DynamoDB table.
 * @param {DynamoDBClient} dbClient - An instance of the AWS DynamoDB client.
 * @param {string} environment - The environment name used as prefix for the DynamoDB table.
 * @returns {Promise<boolean>} - A promise that resolves to true if the participant ID is found, or false if not found.
 * @throws {Error} If there is an error querying the DynamoDB table.
 */
export const lookupParticipant = async (
  participantId,
  table,
  dbClient,
  environment
) => {
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
    TableName: `${environment}-${table}`,
  };

  const command = new QueryCommand(param);
  const response = await dbClient.send(command);

  if (!response?.Items?.length || response.$metadata.httpStatusCode !== 200) {
    // if response is empty, no matching participantId
    console.log("No matches in Population Table");
    return false;
  } else {
    console.log("A match in Population Table");
    return true;
  }
};

/**
 * Saves an object to the Episode table in DynamoDB.
 *
 * @function saveObjToEpisodeTable
 * @async
 * @param {string} csvString - The CSV string to be saved.
 * @param {string} environment - The environment name used as prefix for the DynamoDB table.
 * @param {DynamoDBClient} client - An instance of the AWS DynamoDB client.
 * @param {string} batchId - The batch ID associated with the episode.
 * @param {string} reason - The reason for withdrawal.
 * @param {string} personId - The participant ID.
 * @returns {Promise<boolean>} - A promise that resolves to true if the object was successfully saved, or false if there was an error.
 * @throws {Error} If there is an error updating the DynamoDB table.
 */
export const saveObjToEpisodeTable = async (
  csvString,
  environment,
  client,
  batchId,
  reason,
  personId
) => {
  const createTime = new Date(Date.now()).toISOString();
  const params = {
    Key: {
      Batch_Id: {
        S: batchId,
      },
      Participant_Id: {
        S: personId,
      },
    },
    ExpressionAttributeNames: {
      "#EE": "Episode_Event",
      "#EEU": "Episode_Event_Updated",
      "#ES": "Episode_Status",
      "#ESU": "Episode_Status_Updated",
      "#EEUB": "Episode_Event_Updated_By",
      "#EED": "Episode_Event_Description",
      "#EEN": "Episode_Event_Notes",
    },
    ExpressionAttributeValues: {
      ":Episode_Event_new": {
        S: "Withdrawn",
      },
      ":Episode_Event_Updated_new": {
        S: createTime,
      },
      ":Episode_Status_new": {
        S: "Closed",
      },
      ":Episode_Status_Updated_new": {
        S: createTime,
      },
      ":Episode_Event_Updated_By_new": {
        S: "GTMS",
      },
      ":Episode_Event_Description_new": {
        S: reason,
      },
      ":Episode_Event_Notes_new": {
        S: "NULL",
      },
    },
    TableName: `${environment}-Episode`,
    UpdateExpression:
      "SET #EE = :Episode_Event_new, #EEU = :Episode_Event_Updated_new,  #ES = :Episode_Status_new, #ESU = :Episode_Status_Updated_new, #EEUB = :Episode_Event_Updated_By_new, #EED = :Episode_Event_Description_new, #EEN = :Episode_Event_Notes_new",
  };
  const command = new UpdateItemCommand(params);
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(
        `Error occurred while trying to update db with item: ${csvString}`
      );
      return false;
    } else {
      console.log(`Successfully updated db with item: ${csvString}`);
      return true;
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};
