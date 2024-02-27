import { DynamoDBClient, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const UNSUCCESSFUL_RESPONSE = 400;
/*
  Lambda to get create episode records for modified population records
*/
export const handler = async (event) => {
  const changedRecords = event.Records;
  console.log("Amount of modified records", changedRecords.length);

  const episodeRecordsUpload = await processIncomingRecords(changedRecords, client);

  const filteredRecords = episodeRecordsUpload.filter(record => record.status !== "fulfilled")

  if (filteredRecords.length > 0){
    console.warn("Some Records did not update properly")
  } else {
    return `The episode records have been successfully created.`
  }
};

// METHODS
export async function processIncomingRecords(incomingRecordsArr, dbClient){
  const episodeRecordsUpload = await Promise.allSettled(
    incomingRecordsArr.map(async (record) => {
      if (record.dynamodb.OldImage !== record.dynamodb.NewImage) {
        // upload to episode history
        // generate payload
        const formatRecord = formatEpisodeHistoryRecord(record.dynamodb.NewImage)
        // upload payload
        const uploadRecord = uploadEpisodeHistroyRecord(formatRecord)
        if (uploadRecord.$metadata.httpStatusCode === 200){
          Promise.resolve(`Successfully added or updated participant ${record.dynamodb.NewImage.participantId.S} to Episode History table`)
        } else {
          Promise.reject(`An error occured trying to add ${record.dynamodb.NewImage.participantId.S} to Episode History table`)
        }
      } else {
      console.warn("RECORD HAS NOT BEEN MODIFIED")
      return Promise.reject(`Record ${record.dynamodb.OldImage.participantId.S} has not been modified`);
    }
  })
  )
  return episodeRecordsUpload
}

function createEpisodeRecord(record){
  const createTime = String(Date.now())
  const item =
    {
      'Participant_Id': {
        S: `${record.participantId.S}`
      },
      'Episode_Event': {
        S: `${record.Episode_Event.S}`
      },
      'Episode_Event_Updated': {
        S: createTime
      },
      'Episode_Event_Description': {
        S: createTime
      },
      'Episode_Event_Notes': {
        S: createTime
      },
      'Episode_Event_Updated_By': {
        S: createTime
      },
      'Episode_Status': {
        S: `${record.Episode_Status.S}`
      },
      'Episode_Status_Updated': {
        S: createTime
      },
    }

  return item;
}


async function addEpisodeRecord(table, item) {
  const input = {
    TableName: `${ENVIRONMENT}-${table}`,
    Item: item,
    ConditionExpression: "attribute_not_exists(Batch_Id)",

    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };
  const command = new PutItemCommand(input);
  const response = await client.send(command);

  return response;
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
