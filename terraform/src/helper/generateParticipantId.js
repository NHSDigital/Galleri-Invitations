import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

import RandExp from "randexp";
import uuid4 from "uuid4";

const dbClient = new DynamoDBClient();

const ENVIRONMENT = process.env.environment

const lookupId = async (id, table, key) => {
  const getParams = {
    TableName: `${ENVIRONMENT}-${table}`,
    Key: {
      id: {
        S: id,
      },
    },
    ConsistentRead: true,
  };
  const getCommand = new GetItemCommand(getParams);
  const response = await dbClient.send(getCommand);
  return response.Item;
};

export const generateParticipantID = async () => {
  const participantIdRandExp = new RandExp(
    /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/
  );
  try {
    let participantId;
    let found;
    do {
      participantId = participantIdRandExp.gen();
      found = await lookupId(participantId);
    } while (found);
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};

export const generateEpisodeID = async () => {
  try {
    const episodeUuid = uuid4()
    const episodeId = `EP-${episodeUuid}`
    let found;
    do {
      found = await lookupId(episodeId);
    } while (found);
    return episodeId;
  } catch (err) {
    console.error("Error generating participant id.");
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
      batchId = batchIdRandExp.gen();
      found = await lookupId(batchId);
    } while (found);
    return batchId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};
