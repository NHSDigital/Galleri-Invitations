import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

import RandExp from "randexp";

const dbClient = new DynamoDBClient();
const randExp = new RandExp(
  /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/
);

const lookupParticipantId = async (participantId) => {
  const getParams = {
    TableName: process.env.EPISODE_TABLE,
    Key: {
      participantId: {
        S: participantId,
      },
    },
    ConsistentRead: true,
  };
  const getCommand = new GetItemCommand(getParams);
  const response = await dbClient.send(getCommand);
  return response.Item;
};

export const generateParticipantID = async (event) => {
  try {
    let participantId;
    let found;
    do {
      participantId = randExp.gen();
      found = await lookupParticipantId(participantId);
    } while (found);
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};