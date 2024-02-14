import { DynamoDBClient, BatchWriteItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const UNSUCCESSFUL_RESPONSE = 400;
/*
  Lambda to get create episode records for modified population records
*/
export const handler = async (event) => {
  const changedRecords = event.Records;
  const chunkSize = 25;
  console.log("Amount of modified records", changedRecords.length);

  const episodeRecordsUpload = await processIncomingRecords(changedRecords, client);

  const filteredRecords = episodeRecordsUpload.filter(record => record.status !== "rejected")
  let responseArray;
  console.log(`Number of records that were not rejected = ${filteredRecords.length}`)
  if (filteredRecords.every( element => element.value !== UNSUCCESSFUL_RESPONSE)){
    const sendRequest = await loopThroughRecords(filteredRecords, chunkSize, client)
    responseArray = await Promise.allSettled(sendRequest)
  }
  if (responseArray.status == "rejected"){
    return new Error(`The episode records have not been successfully created.`)
  }
  return `The episode records have been successfully created.`
};

// METHODS
export async function processIncomingRecords(incomingRecordsArr, dbClient){
  const episodeRecordsUpload = await Promise.allSettled(
    incomingRecordsArr.map(async (record) => {
      if (record.dynamodb.OldImage.identified_to_be_invited.BOOL === false && record.dynamodb.NewImage.identified_to_be_invited.BOOL) {
        if (await lookupParticipantId(record.dynamodb.NewImage.participantId.S, "Episode", dbClient)){
          return createEpisodeRecord(record.dynamodb.NewImage);
        } else {
          console.log("RECORD ALREADY EXISTS")
          return Promise.reject("Not new record");
        }
      }
      return Promise.reject("Record has not been modified");
    })
  )
  return episodeRecordsUpload
}

function createEpisodeRecord(record){
  const createTime = String(Date.now())
  const item = {
    PutRequest: {
      Item: {
        'Batch_Id': {
          S: `${record.Batch_Id.S}`
        },
        'Participant_Id': {
          S: `${record.participantId.S}`
        },
        'LSOA': {
          S: `${record.LsoaCode.S}`
        },
        'Gp_Practice_Code': {
          S: `${record.gpPracticeCode.S}`
        },
        'Episode_Created_By': {
          S: `UserName` // need to pull in username when able to access
        },
        'Episode_Creation': {
          S: createTime
        },
        'Episode_Status_Updated': {
          S: createTime
        },
        'Episode_Status': {
          S: `Open`
        },
        'Episode_Event': {
          S: `Invited`
        },
        'Episode_Event_Updated': {
          S: createTime
        }
      }
    }
  }

  return Promise.resolve(item)
}

// look into episode table and see if there exists a participant
export const lookupParticipantId = async (participantId, table, dbClient) => {
  const input = {
    ExpressionAttributeValues: {
      ":participant": {
        S: `${participantId}`,
      },
    },
    KeyConditionExpression: "Participant_Id = :participant",
    ProjectionExpression: "Participant_Id",
    TableName: `${ENVIRONMENT}-${table}`,
    IndexName: "Participant_Id-index",
  };

  const command = new QueryCommand(input);
  const response = await dbClient.send(command);
  if (!response.Items.length){ // if response is empty, no matching participantId
    return true
  }
  console.log("Duplicate exists")
  return false;
};

export async function loopThroughRecords(episodeRecordsUpload, chunkSize, dbClient) {
  console.log(`Number of records to push to db = ${episodeRecordsUpload.length}`)
  const sendRequest = [];
  if (episodeRecordsUpload.length === 0) return sendRequest; // handle edge case

  for (let i = 0; i < episodeRecordsUpload.length; chunkSize) {
    if ((episodeRecordsUpload.length - i) < chunkSize){ // remaining chunk
      const batch = episodeRecordsUpload.splice(i, episodeRecordsUpload.length - i);
      console.log("Writing remainder")
      sendRequest.push(await batchWriteToDynamo(dbClient, `Episode`, batch));
      return sendRequest;
    }
    const batch = episodeRecordsUpload.splice(i, chunkSize);
    console.log("Writing to dynamo")
    sendRequest.push(await batchWriteToDynamo(dbClient, `Episode`, batch));
  }
  return sendRequest
}

export async function batchWriteToDynamo(dbClient, table, uploadBatch){
  // split out array
  const filterUploadBatch = uploadBatch.map(record => record.value);

  if (filterUploadBatch.length !== 0) {
    let requestItemsObject = {};
    requestItemsObject[`${ENVIRONMENT}-${table}`] = filterUploadBatch;

    const command = new BatchWriteItemCommand({
      RequestItems: requestItemsObject
    });

    const response = await dbClient.send(command);
    return response.$metadata.httpStatusCode;
  }
  return UNSUCCESSFUL_RESPONSE;
}
