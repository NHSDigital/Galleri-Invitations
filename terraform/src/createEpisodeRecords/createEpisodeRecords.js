import {
  DynamoDBClient,
  QueryCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
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

/**
 * Processes the incoming population records.
 * @param {Object[]} incomingRecordsArr - The modified population records to be processed.
 * @param {DynamoDBClient} dbClient - The DynamoDB client used for database interactions.
 * @returns {Object} The newly episode records upload with the necessary fields.
 */
export async function processIncomingRecords(incomingRecordsArr, dbClient) {
  console.log("Entered function processIncomingRecords");
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
            const errorMsg = `Unable to add record ${record.dynamodb.OldImage.participantId.S}`;
            console.error("Error: ", errorMsg);
            return Promise.reject(errorMsg);
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
  console.log("Exiting function processIncomingRecords");
  return episodeRecordsUpload;
}

/**
 * Creates a new episode record.
 * @param {Object} record -Record containing the data to create the new episode record.
 * @returns {Object} The newly created episode record with the necessary fields.
 */
export function createEpisodeRecord(record) {
  console.log("Entered function createEpisodeRecord");
  const createTime = new Date(Date.now()).toISOString();
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
      S: `${record.gp_connect.S}`,
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
    Episode_Event_Updated_By: {
      S: "GPS",
    },
  };

  console.log("Exiting function createEpisodeRecord");
  return item;
}

/**
 * Add new a record to the Episode table
 * @param {string} table - Episode table name.
 * @param {Object} item - The item to be added to the Episode table.
 */
async function addEpisodeRecord(table, item) {
  console.log("Entered function addEpisodeRecord");
  const input = {
    TableName: `${ENVIRONMENT}-${table}`,
    Item: item,
    ConditionExpression: "attribute_not_exists(Batch_Id)",

    ReturnValuesOnConditionCheckFailure: "ALL_OLD",
  };
  const command = new PutItemCommand(input);
  const response = await client.send(command);

  console.log("Exiting function addEpisodeRecord");
  return response;
}

/**
 * look into Episode table and see if there exists a participant
 * @param {string} participantId - The participant ID to look up in the Episode table.
 * @param {string} table - The name of the Episode table.
 * @param {DynamoDBClient} dbClient - The DynamoDB client used for querying the Episode table.
 */
export const lookupParticipantId = async (participantId, table, dbClient) => {
  console.log("Entered function lookupParticipantId");
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
  console.log("Exiting function lookupParticipantId");
  return false;
};
