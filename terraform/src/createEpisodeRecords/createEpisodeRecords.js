import { DynamoDBClient, BatchWriteItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
// import { generateEpisodeID, generateParticipantID} from "../helper/generateParticipantId"
import uuid4 from "uuid4";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/

export const handler = async (event) => {
  // for a modify we are just going to get a single record.
  const changedRecords = event.Records
  const chunkSize = 3
  console.log("Amount of modified records", changedRecords.length)

  const episodeRecordsUpload = await Promise.allSettled(
    changedRecords.map(async (record) => {
      if (record.dynamodb.OldImage.identified_to_be_invited.BOOL === false && record.dynamodb.NewImage.identified_to_be_invited.BOOL) {
        return await createEpisodeRecord(record.dynamodb.NewImage)
      }
    })
  )
  const sendRequest = await loopThroughRecords(episodeRecordsUpload, chunkSize)

  const responseArray = await Promise.allSettled(sendRequest)

  // const responseArray = await Promise.allSettled(
  //   episodeRecordsUpload.map(async (record , index) => {
  //     const iterator = index + 1
  //     console.log("Iterator = ", iterator)
  //     if ((iterator) % chunkSize == 0){ // we are at the predefined batch size limit
  //       const lowerBound = (iterator) - chunkSize // 3 - 3 = 0
  //       const upperBound = iterator // 3
  //       return await batchWriteToDynamo(client, `Episode`, episodeRecordsUpload, lowerBound, upperBound, index +1, changedRecords.length )
  //     } else if ((iterator) == changedRecords.length) { // handle remaining records that don't fall into batch size
  //       console.log("Handling remaing records")
  //       let lowerBound
  //       let upperBound
  //       if (changedRecords.length < chunkSize){ // handle edge case where no. records changed are fewer than specified batchWrite size
  //         console.log("This IS an edge case")
  //         upperBound = changedRecords.length
  //         lowerBound = 0
  //         return await batchWriteToDynamo(client, `Episode`, episodeRecordsUpload, lowerBound, upperBound, index + 1, changedRecords.length)
  //       } else {
  //         console.log("Not an edge case")
  //         upperBound = changedRecords.length // 4
  //         lowerBound = changedRecords.length - chunkSize + 1 // 4 - 3 = 1
  //         return await batchWriteToDynamo(client, `Episode`, episodeRecordsUpload, lowerBound, upperBound, index + 1, changedRecords.length)
  //       }
  //     }
  // }));

  // const filteredArray = responseArray.filter(response => {
  //   return response.value !== undefined
  // })
  console.log("Completed. responseArray ->", responseArray)
  console.log("Completed. responseArray length ->", responseArray.length)
};

// METHODS
async function batchWriteToDynamo(client, table, uploadBatch, index, arraySize){
  console.log(`writing batch at index ${index}/${arraySize} to batchWriteDynamo`)
  // split out array
  console.log("Sliced array size = " + uploadBatch.length)

  const filteruploadBatch = uploadBatch.map(record => record.value)

  let requestItemsObject = {}
  requestItemsObject[`${ENVIRONMENT}-${table}`] = filteruploadBatch

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject
  });

  console.log({
    RequestItems: requestItemsObject
  })
  const response = await client.send(command);
  return response.$metadata.httpStatusCode;

}

async function createEpisodeRecord(record){
  const batchId = await generateBatchID() // move in generateTriggersLambda
  const episodeId = await generateEpisodeID(batchId)

  const item = {
    PutRequest: {
      Item: {
        'Episode_Id': { // move in generateTriggersLambda
          S: `${episodeId}` // move in generateTriggersLambda
        }, // move in generateTriggersLambda
        'Batch_Id': {
          S: `${batchId}`
        },
        'Person_Id': {
          S: `${record.PersonId.S}`
        }
      }
    }
  }

  return item
}


const lookupId = async (episodeId, batchId, table, partitionKey, sortKey) => {
  let keyObj = {}
  keyObj[partitionKey] = {
    S: episodeId
  }
  keyObj[sortKey] = {
    S: batchId
  }
  const getParams = {
    TableName: `${ENVIRONMENT}-${table}`,
    Key: keyObj,
    ConsistentRead: true,
  };
  const getCommand = new GetItemCommand(getParams);
  const response = await client.send(getCommand);
  return response.$metadata.httpStatusCode;
};

/* Episode_ID is the hash key for the episode table,
  hence we can use the dynamodb property of unique
  hash keys as validation for episodeId
*/
export const generateEpisodeID = async (batchId) => {
  try {
    const episodeUuid = uuid4()
    const episodeId = `EP-${episodeUuid}`
    let found = 400;
    do {
      console.log("In generateEpisodeID. Checking if episodeId exists in Episode table")
      found = await lookupId(episodeId, batchId, `Episode`, "Episode_Id", "Batch_Id");
    } while (found == 400);
    return episodeId;
  } catch (err) {
    console.error("Error generating episode id.");
    console.error(err);
    return err;
  }
};

export const generateBatchID = async () => {
  try {
    const batchUuid = uuid4()
    const batchId = `EP-${batchUuid}`
    let found;
    // do {
    //   found = await lookupId(batchId, "Population", "PersonId");
    //   console.log("In generateBatchID. Checking if batchId exists in Population table")
    // } while (found);
    return batchId;
  } catch (err) {
    console.error("Error generating batch id.");
    console.error(err);
    return err;
  }
};

async function loopThroughRecords(episodeRecordsUpload, chunkSize, ) {
  const sendRequest = []
  for (let i = 0; i < episodeRecordsUpload.length; chunkSize) {
    if ((episodeRecordsUpload.length - i) < chunkSize){ // remaining chunk
      const batch = episodeRecordsUpload.splice(i, episodeRecordsUpload.length - i)
      sendRequest.push(batchWriteToDynamo(client, `Episode`, batch, i, episodeRecordsUpload.length))
      return sendRequest
    }
    const batch = episodeRecordsUpload.splice(i, chunkSize)
    sendRequest.push(batchWriteToDynamo(client, `Episode`, batch, i, episodeRecordsUpload.length))
  }
}
