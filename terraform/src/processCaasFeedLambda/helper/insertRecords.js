import records from "./caasFeedArray.json" assert { type: "json" };
import {
  QueryCommand
} from "@aws-sdk/client-dynamodb";

const SUCCESSFULL_REPSONSE = 200
const UNSUCCESSFULL_REPSONSE = 200

/* Supplied NHS No/ does not exist in MPI And Superseded by NHS No. == Null
  - If record with NHS No DOES NOT exists in population table:
    - generate participantId
    - use primary_care_provider code to look up ICB code. Add this as responsible_ICB attribue
    - set persons LSOA
    - insert item into pop table
*/
/* Supplied NHS No. does not exist in MPI AND superseded by NHS No. !== Null AND Superseded by NHS No. does not exist in the MPI
  - If record with NHS No DOES NOT exists in population table && Superseded by NHS No DOES NOT exist:
    - set NHS No to Superseded by NHS No
    - generate participantId
    - use primary_care_provider code to look up ICB code. Add this as responsible_ICB attribue
    - set persons LSOA
    - insert item into pop table
*/
// Not in 440
// Supplied NHS No. exists in MPI AND superseded by NHS No. == Null
// Supplied NHS no. exists in MPI AND superseded by NHS no. !== Null AND superseded by NHS No. exists in the MPI

// const checkIcbCode = checkDynamoTable(dbClient, primarCareProviderCode, "GpPractice", "primarCareProviderCode", false)
// const checkSupersededByNhsNo = checkDynamoTable(dbClient, supersededByNhsNo, "Population", "supersededByNhsNo", true)
// const checkNhsNo = checkNhsNo(dbClient, nhsNo, "Population", "nhsNo", true)

// METHODS


/* Participant_Id must be a unique value in the Population table
  thus we can not use the in built dynamodb validation for uniqueness
  We must instead use the query operation
*/
export const generateParticipantID = async (dbClient) => {
  const participantIdRandExp = new RandExp(
    /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/
  );
  try {
    let participantId;
    let found;
    do {
      participantId = participantIdRandExp.gen();
      console.log("Checking if participantId exists in Population table")
      found = await lookUp(dbClient, participantId, "Population", "participatingId", true);
    } while (found);
    console.log(`participantId = ${participantId}`)
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};

export const checkDynamoTable = async (dbClient, attribute, table, attributeName, useIndex) => {
  try {
    const checkTable = lookUp(dbClient, attribute, table, attributeName, useIndex);
    if (checkTable = UNSUCCESSFULL_REPSONSE) return false;
    return true;
  } catch (err) {
    console.error(`Error checking the ${attribute} in ${table} table.`);
    console.error(err);
    return err;
  }
}

export const lookUp = async (dbClient, ...params) => {
  const {
    id,
    table,
    attribute,
    useIndex
  } = params

  const ExpressionAttributeValuesKey = `:${attribute}`

  const input = {
    ExpressionAttributeValues: {
      ExpressionAttributeValuesKey: {
        S: `${id}`,
      },
    },
    KeyConditionExpression: `${attribute} = :${attribute}`,
    ProjectionExpression: `${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) input.IndexName = `${attribute}-index`

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);
  if (!response.Items.length === 0){
    return UNSUCCESSFULL_REPSONSE; // participatingId already exists
  }
  return SUCCESSFULL_REPSONSE;
};
