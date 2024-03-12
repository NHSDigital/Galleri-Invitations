//IMPORTS
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
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
    const REASON = js?.['Withdrawal']?.['Reason'];
    console.log(PERSON_ID); //NHS-AC35-BS33

    const retrievedBatchID = await lookupParticipantId(PERSON_ID, 'Episode', client, ENVIRONMENT);

    if (await lookupParticipant(PERSON_ID, 'Population', client, ENVIRONMENT)) {
      if (retrievedBatchID) {
        console.log('update inside here');
        console.log(retrievedBatchID);
        /*AC2: update episode record data with:
          Episode Event = 'Withdrawn'
          Episode Event Updated = current system date timestamp
          Episode Event Description = reason, will be js?.['Withdrawal]?.['Reason]
          Episode Event Notes = NULL
          Episode Event Updated By = GTMS
          Episode Status = Closed
        */
        const saved = await saveObjToEpisodeTable(csvString, ENVIRONMENT, client, retrievedBatchID[0], REASON, PERSON_ID);
        console.log(saved);
      } else {
        console.log('fail');
        //AC1c: Save rejected record folder: 'episode does not exist'
      }
    } else {
      console.log('fail');
      //AC1b: Save rejected record folder: 'Participant Id does not exist'
    }

    // const searching = await lookupParticipant(PERSON_ID, 'Population', client, ENVIRONMENT);
    // console.log(searching);
    // const value = await lookupParticipantId(PERSON_ID, 'Episode', client, ENVIRONMENT);
    // console.log(value);


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
    console.log(`Failed to push to ${bucketName}/${key}. Error Message: ${err}`);
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

//Used to lookup participant from episode table
export const lookupParticipantId = async (participantId, table, dbClient, environment) => {
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
  if (!response.Items.length || response.$metadata.httpStatusCode !== 200) { // if response is empty, no matching participantId
    return [""];
  }
  console.log('match');
  return [response["Items"][0]["Batch_Id"]["S"]];
};

//Used to lookup participant from population table
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

export const saveObjToEpisodeTable = async (csvString, environment, client, batchId, reason, personId) => {
  const createTime = String(Date.now())
  const params = {
    "Key": {
      "Batch_Id": {
        "S": batchId,
      },
      "Participant_Id": {
        "S": personId,
      }
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
        "S": "Withdrawn",
      },
      ":Episode_Event_Updated_new": {
        "S": createTime,
      },
      ":Episode_Status_new": {
        "S": "Closed",
      },
      ":Episode_Status_Updated_new": {
        "S": createTime,
      },
      ":Episode_Event_Updated_By_new": {
        "S": "GTMS",
      },
      ":Episode_Event_Description_new": {
        "S": reason,
      },
      ":Episode_Event_Notes_new": {
        "S": "NULL",
      },
    },
    TableName: `${environment}-Episode`,
    UpdateExpression: "SET #EE = :Episode_Event_new, #EEU = :Episode_Event_Updated_new,  #ES = :Episode_Status_new, #ESU = :Episode_Status_Updated_new, #EEUB = :Episode_Event_Updated_By_new, #EED = :Episode_Event_Description_new, #EEN = :Episode_Event_Notes_new"
  };

  const command = new UpdateItemCommand(params);
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error updating item: ${csvString}`);
      return false;
    } else {
      console.log(`Successfully updated with item: ${csvString}`);
      return true;
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};
