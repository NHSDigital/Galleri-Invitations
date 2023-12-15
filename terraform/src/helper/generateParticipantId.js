import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

import RandExp from "randexp";
import uuid4 from "uuid4";

const client = new DynamoDBClient();

const ENVIRONMENT = process.env.environment

const lookupId = async (id, table, hashKey) => {
  const getParams = {
    TableName: `${ENVIRONMENT}-${table}`,
    Key: {
    	hashKey: {
        S: id,
      },
    },
    ConsistentRead: true,
  };
  console.log(`getParams = ${getParams}`)
  const getCommand = new GetItemCommand(getParams);
  const response = await client.send(getCommand);
  return response.Item;
};

const queryId = async (id, table, hashKey) => {
  const getParams = {
    TableName: `${ENVIRONMENT}-${table}`,
    Key: {
    	hashKey: {
        S: id,
      },
    },
    ConsistentRead: true,
  };
  console.log(`getParams = ${getParams}`)
  const getCommand = new GetItemCommand(getParams);
  const response = await client.send(getCommand);
  return response.Item;
};

/* Participant_Id must be a unique value in the Episode table
  thus we  can not use the in built dynamodb validation for uniqueness
  We must instead use the query operation
*/
export const generateParticipantID = async () => {
  const participantIdRandExp = new RandExp(
    /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/
  );
  try {
    let participantId;
    let found;
    do {
      participantId = participantIdRandExp.gen();
      console.log("In generateParticipantID. Checking if participantId exists in Episode table")
      found = await lookupId(participantId, "Episode", "Episode_ID");
    } while (found);
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};

/* Episode_ID is the hash key for the episode table,
  hence we can use the dynamodb property of unique
  hash keys as validation for episodeId
*/
export const generateEpisodeID = async () => {
  try {
    const episodeUuid = uuid4()
    const episodeId = `EP-${episodeUuid}`
    let found;
    do {
        console.log("In generateEpisodeID. Checking if episodeId exists in Episode table")
      found = await lookupId(episodeId, "Episode", "Episode_ID");
    } while (found);
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
    do {
      console.log("In generateBatchID. Checking if batchId exists in Population table")
      found = await lookupId(batchId, "Population", "PersonId");
    } while (found);
    return batchId;
  } catch (err) {
    console.error("Error generating batch id.");
    console.error(err);
    return err;
  }
};
