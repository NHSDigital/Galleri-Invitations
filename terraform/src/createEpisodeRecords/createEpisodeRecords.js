import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const UNSUCCESSFUL_RESPONSE = 400;
/*
  Lambda to get create episode records for modified population records
*/
export const handler = async (event) => {
  const changedRecords = event.Records;
  console.log("Amount of modified records", changedRecords.length);

  const episodeRecordsUpload = await processIncomingRecords(
    changedRecords,
    client
  );

  const filteredRecords = episodeRecordsUpload.filter(
    (record) => record.status !== "fulfilled"
  );

  if (filteredRecords.length > 0) {
    console.warn("Some Records did not update properly");
  } else {
    return `The episode records have been successfully created.`;
  }
};

// METHODS
export async function processIncomingRecords(incomingRecordsArr, dbClient) {
  const episodeRecordsUpload = await Promise.allSettled(
    incomingRecordsArr.map(async (record) => {
      if (
        record.dynamodb.OldImage.identified_to_be_invited.BOOL === false &&
        record.dynamodb.NewImage.identified_to_be_invited.BOOL
      ) {
        if (
          await lookupParticipantId(
            record.dynamodb.NewImage.participantId.S,
            "Episode",
            dbClient
          )
        ) {
          const episodeRecord = createEpisodeRecord(record.dynamodb.NewImage);
          const addEpisodeRecordResponse = await addEpisodeRecord(
            "Episode",
            episodeRecord
          );
          if (addEpisodeRecordResponse.$metadata.httpStatusCode === 200) {
            return Promise.resolve("Successfully added");
          } else {
            return Promise.reject(
              `Unable to add record ${record.dynamodb.OldImage.participantId.S}`
            );
          }
        } else {
          console.warn("RECORD ALREADY EXISTS");
          return Promise.reject(
            `Record ${record.dynamodb.OldImage.participantId.S} is not a new record`
          );
        }
      }
      console.warn("RECORD HAS NOT BEEN MODIFIED");
      return Promise.reject(
        `Record ${record.dynamodb.OldImage.participantId.S} has not been modified`
      );
    })
  );
  return episodeRecordsUpload;
}

function createEpisodeRecord(record) {
  const createTime = String(Date.now());
  const item = {
    Batch_Id: {
      S: `${record.Batch_Id.S}`,
    },
    Participant_Id: {
      S: `${record.participantId.S}`,
    },
    LSOA: {
      S: `${record.LsoaCode.S}`,
    },
    Gp_Practice_Code: {
      S: `${record.gpPracticeCode.S}`,
    },
    Episode_Created_By: {
      S: `${record.created_by.S}`,
    },
    Episode_Creation: {
      S: createTime,
    },
    Episode_Status_Updated: {
      S: createTime,
    },
    Episode_Status: {
      S: `Open`,
    },
    Episode_Event: {
      S: `Invited`,
    },
    Episode_Event_Updated: {
      S: createTime,
    },
  };

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
  if (!response.Items.length) {
    // if response is empty, no matching participantId
    return true;
  }
  console.log("Duplicate exists");
  return false;
};
