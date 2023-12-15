import { DynamoDBClient, BatchWriteItemCommand, GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import uuid4 from "uuid4";
import RandExp from "randexp";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to get create episode records for modified population records
*/
export const handler = async (event) => {
  // for a modify we are just going to get a single record.
  const changedRecords = event.Records
  const chunkSize = 3
  console.log("Amount of modified records", changedRecords.length)

  const episodeRecordsUpload = await Promise.allSettled(
    changedRecords.map(async (record, index) => {
      if (record.dynamodb.OldImage.identified_to_be_invited.BOOL === false && record.dynamodb.NewImage.identified_to_be_invited.BOOL) {
        if (await isNewRecord(record.dynamodb.NewImage)){ // just needs to check if participantId is unique here
          return createEpisodeRecord(record.dynamodb.NewImage);
        }
        return Promise.reject("Not new record");
      }
    })
  )
  console.log("episodeRecordsUpload = ", JSON.stringify(episodeRecordsUpload, null, 2))
  const filteredRecords = episodeRecordsUpload.filter(record => record.status !== "rejected")
  console.log(`Number of records that can not be created an episode against = ${episodeRecordsUpload.length - filteredRecords.length}`)
  const sendRequest = await loopThroughRecords(filteredRecords, chunkSize)

  const responseArray = await Promise.allSettled(sendRequest)

  console.log("Completed. responseArray ->", responseArray)
  console.log("Completed. responseArray length ->", responseArray.length)
};

// METHODS
// check if record is in episode table using participantId
async function isNewRecord(record){
  console.log(`Participant_Id = ${JSON.stringify(record.participantId.S)}, Batch_Id = ${JSON.stringify(record.Batch_Id.S)}, identified_to_be_invited = ${JSON.stringify(record.identified_to_be_invited.BOOL)}`)

  const queryResult = await lookupParticipantId(record.participantId.S, "Episode");
  console.log("queryResult = ", queryResult)
  if (queryResult === 200){ // record does not exists in episode table.
    return true;
  }
  return false;
}

function createEpisodeRecord(record){
  const item = {
    PutRequest: {
      Item: {
        'Batch_Id': {
          S: `${record.Batch_Id.S}`
        },
        'Participant_Id': {
          S: `${record.participantId.S}`
        }
      }
    }
  }

  return item
}

// look into episode table and see if there exists a participant
const lookupParticipantId = async (participantId, table) => {
  const input = {
    ExpressionAttributeValues: {
      ":participant": {
        S: `${participantId}`,
      },
    },
    KeyConditionExpression: "Participant_Id = :participant",
    ProjectionExpression: "Participant_Id",
    TableName: `${ENVIRONMENT}-${table}`,
    IndexName: "ParticipantId-index",
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);
  if (!response.Items.length){ // if response is empty, no matching participantId
    return 200
  }
  console.log("Duplicate exists")
  return 400;
};

async function loopThroughRecords(episodeRecordsUpload, chunkSize) {
  const sendRequest = []
  if (episodeRecordsUpload.length === 0) return sendRequest // handle edge case

  for (let i = 0; i < episodeRecordsUpload.length; chunkSize) {
    console.log("Batching records " + (i-chunkSize) + " to " + i + " to upload" )
    if ((episodeRecordsUpload.length - i) < chunkSize){ // remaining chunk
      const batch = episodeRecordsUpload.splice(i, episodeRecordsUpload.length - i)
      sendRequest.push(batchWriteToDynamo(client, `Episode`, batch))
      return sendRequest
    }
    const batch = episodeRecordsUpload.splice(i, chunkSize)
    sendRequest.push(batchWriteToDynamo(client, `Episode`, batch))
  }
}

async function batchWriteToDynamo(client, table, uploadBatch){
  // split out array
  console.log("Sliced array size = " + uploadBatch.length)

  const filterUploadBatch = uploadBatch.map(record => record.value)

  let requestItemsObject = {}
  requestItemsObject[`${ENVIRONMENT}-${table}`] = filterUploadBatch

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject
  });

  const response = await client.send(command);
  return response.$metadata.httpStatusCode;

}


/* Participant_Id must be a unique value in the Episode table
  thus we  can not use the in built dynamodb validation for uniqueness
  We must instead use the query operation
*/
// export const generateParticipantID = async () => {
//   try {
//     let participantId;
//     let found = 400;
//     do {
//       found = await lookupParticipantId(participantId, "Episode");
//       participantId = participantIdRandExp.gen();
//     } while (found == 400);
//     return participantId;
//   } catch (err) {
//     console.error("Error generating participant id.");
//     console.error(err);
//     return err;
//   }
// };

// ensure one episode record per person
// const lookUpRecord = async (Batch_ID, personId, table, partitionKey, sortKey) => {
//   let keyObj = {}
//   keyObj[partitionKey] = {
//     S: Batch_ID
//   }
//   keyObj[sortKey] = {
//     S: personId
//   }
//   const getParams = {
//     TableName: `${ENVIRONMENT}-${table}`,
//     Key: keyObj,
//     ConsistentRead: true,
//   };
//   const getCommand = new GetItemCommand(getParams);
//   const response = await client.send(getCommand);
//   return response.Item;
// };
