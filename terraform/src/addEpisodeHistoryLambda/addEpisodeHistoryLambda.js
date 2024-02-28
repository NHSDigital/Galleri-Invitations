import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import isEqual from 'lodash.isequal'

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
      console.log(record)
      if (!isEqual(record.dynamodb?.OldImage, record.dynamodb.NewImage)) {
        // upload to episode history
        // generate payload
        const formatRecord = formatEpisodeHistoryRecord(record.dynamodb.NewImage)
        console.log("formatRecord")
        console.log(formatRecord)
        // upload payload
        const uploadRecord = uploadEpisodeHistoryRecord(formatRecord, dbClient)
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

function formatEpisodeHistoryRecord(record){
  const createTime = String(Date.now())

  const params = {
  "Key": {
    "Participant_Id": {
        S: `${record.participantId.S}`
    }
  },
  "ExpressionAttributeNames": {
      "#EE": "Episode_Event",
      "#EEU": "Episode_Event_Updated",
      "#EED": "Episode_Event_Description",
      "#EEN": "Episode_Event_Notes",
      "#EEUB": "Episode_Event_Updated_By",
      "#ES": "Episode_Status",
      "#ESU": "Episode_Status_Updated",
  },
  "ExpressionAttributeValues": {
      ":episode_event": {
          S: `${record?.Episode_Event.S}`
      },
      ":episode_event_updated": {
          N: createTime
      },
      ":episode_event_description": {
          S: `${record?.Episode_Event_Description.S}`
      },
      ":episode_event_notes": {
          S: `${record?.Episode_Event_Notes.S}`
      },
      ":episode_event_updated_by": {
          S: `${record?.Episode_Event_Updated_By.S}`
      },
      ":episode_status": {
          S: `${record?.Episode_Status.S}`
      },
      ":episode_status_updated": {
          N: `${record?.Episode_Status_Updated.N}`
      }
  },
  "TableName": `${environment}-EpisodeHistory`,
  "UpdateExpression": `
    set
    #EE = :episode_event,
    #EEU = :episode_event_updated,
    #EED = :episode_event_description,
    #EEN = :Episode_Event_Notes,
    #EEUB = :Episode_Event_Updated_By,
    #ES = :Episode_Status,
    #ESU = :Episode_Status_Updated,`,
  };

  return params;
}

async function uploadEpisodeHistoryRecord(input) {

  const command = new UpdateItemCommand(input);
  const response = await client.send(command);

  return response;
}
