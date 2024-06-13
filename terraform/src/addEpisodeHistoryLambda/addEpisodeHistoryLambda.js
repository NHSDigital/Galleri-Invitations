import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import isEqual from "lodash.isequal";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * Lambda handler to add episode history records when episode records have been
 * added or modified.
 *
 * @async
 * @function handler
 * @param {Object} event Dynamodb event trigger
 * @returns {string} Success message
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
/**
 * Processes new or updated episode records and insert episode history records.
 *
 * @async
 * @function processIncomingRecords
 * @param {Array} incomingRecordsArr Array of new or modified episode records
 * @param {DynamoDBClient} dbClient Dynamodb client
 * @returns {Promise<Array<string>>} Promise resolves to array of success/failure message
 */
export const processIncomingRecords = async (incomingRecordsArr, dbClient) => {
  const episodeRecordsUpload = await Promise.allSettled(
    incomingRecordsArr.map(async (record) => {
      const oldImage = record.dynamodb?.OldImage;
      const newImage = record.dynamodb.NewImage;

      if (!isEqual(oldImage, newImage)) {
        // generate payload
        const formatRecord = formatEpisodeHistoryRecord(newImage);
        // upload payload
        const uploadRecord = await uploadEpisodeHistoryRecord(
          formatRecord,
          dbClient
        );
        if (uploadRecord.$metadata.httpStatusCode == 200) {
          return Promise.resolve(
            `Successfully added or updated participant ${newImage.Participant_Id.S} to Episode History table`
          );
        } else {
          const msg = `An error occured trying to add ${newImage.Participant_Id.S} episode event ${newImage.Episode_Event.S} to Episode History table`;
          console.error(msg);
          return Promise.reject(msg);
        }
      } else {
        console.warn("RECORD HAS NOT BEEN MODIFIED");
        return Promise.reject(
          `Record ${oldImage.Participant_Id.S} has not been modified`
        );
      }
    })
  );

  return episodeRecordsUpload;
};

/**
 * Formats an episode history update command parameters object.
 *
 * @function formatEpisodeHistoryRecord
 * @param {Object} record An episode record
 * @returns {Object} Update command parameters object
 */
export const formatEpisodeHistoryRecord = (record) => {
  console.log("*********Record: ", record);
  const params = {
    Key: {
      Participant_Id: {
        S: `${record.Participant_Id.S}`,
      },
      Episode_Event_Updated: {
        S: `${record?.Episode_Event_Updated.S}`
      },
    },
    ExpressionAttributeNames: {
      "#EE": "Episode_Event",
      "#EED": "Episode_Event_Description",
      "#EEN": "Episode_Event_Notes",
      "#EEUB": "Episode_Event_Updated_By",
      "#ES": "Episode_Status",
      "#ESU": "Episode_Status_Updated",
    },
    ExpressionAttributeValues: {
      ":episode_event": {
        S: `${record?.Episode_Event.S}`,
      },
      ":episode_event_description": {
        S:
          `${record?.Episode_Event_Description?.S}` === "undefined"
            ? ""
            : `${record?.Episode_Event_Description?.S}`,
      },
      ":episode_event_notes": {
        S:
          `${record?.Episode_Event_Notes?.S}` === "undefined"
            ? ""
            : `${record?.Episode_Event_Notes?.S}`,
      },
      ":episode_event_updated_by": {
        S:
          `${record?.Episode_Event_Updated_By?.S}` === "undefined"
            ? ""
            : `${record?.Episode_Event_Updated_By?.S}`,
      },
      ":episode_status": {
        S: `${record?.Episode_Status.S}`,
      },
      ":episode_status_updated": {
        S: `${record?.Episode_Status_Updated.S}`,
      },
    },
    TableName: `${ENVIRONMENT}-EpisodeHistory`,
    UpdateExpression: `set #EE = :episode_event, #EED = :episode_event_description, #EEN = :episode_event_notes, #EEUB = :episode_event_updated_by, #ES = :episode_status, #ESU = :episode_status_updated`,
  };

  return params;
};

/**
 * Update Dynamodb table with given parameters.
 *
 * @async
 * @function uploadEpisodeHistoryRecord
 * @param {Object} item Update command parameters
 * @param {DynamoDBClient} dbClient Dynamodb client
 * @returns {Promise<Object>} Promise resolves to update command response
 */
export const uploadEpisodeHistoryRecord = async (item, dbClient) => {
  const command = new UpdateItemCommand(item);
  const response = await dbClient.send(command);

  return response;
};
