import records from "./caasFeedArray.json" assert { type: "json" };
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  BatchWriteItemCommand
} from "@aws-sdk/client-dynamodb";

const SUCCESSFULL_REPSONSE = 200
const UNSUCCESSFULL_REPSONSE = 200

const client = new DynamoDBClient({ region: "eu-west-2" });
const recordsToUpload = [];

records.forEach(async (record) => {
  if (await checkDynamoTable(dbClient, nhsNo, "Population", "nhsNo", true)){ // Supplied NHS No. exists
    if (superseded_by_nhs_number === 'null'){ // Superseded by NHS No. == Null ---> C)
      // ---- C ---- AC5
    } else { // Superseded by NHS No. !== Null
      if (await !checkDynamoTable(dbClient, supersededByNhsNo, "Population", "supersededByNhsNo", true)) { // Superseded by NHS No. does not exist in the MPI ---> D)
        // ---- D ---- AC6
      }
    }
  } else { // Supplied NHS No/ does not exist
    if (superseded_by_nhs_number === 'null'){ // Superseded by NHS No. == Null --> A)
      // ---- A ---- AC1
      const formattedRecord = generateRecord(record, client)
      recordsToUpload.push(formatDynamoDbRecord(formattedRecord));
    } else { // Superseded by NHS No. !== Null
      if (await !checkDynamoTable(dbClient, supersededByNhsNo, "Population", "supersededByNhsNo", true)) { // Superseded by NHS No. does not exist in the MPI ---> B)
        // ---- B ---- AC2
        record.nhs_number = record.superseded_by_nhs_number
        const formattedRecord = generateRecord(record, client)
        recordsToUpload.push(formatDynamoDbRecord(formattedRecord))
      }
    }
  }
})

const uploadRecords = batchWriteRecords(recordsToUpload, 25, client);

// METHODS
export const generateParticipantID = async (dbClient) => {
  /* Participant_Id must be a unique value in the Population table
  thus we can not use the in built dynamodb validation for uniqueness
  We must instead use the query operation
*/
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
    const checkTable = await lookUp(dbClient, attribute, table, attributeName, useIndex);
    if (checkTable === UNSUCCESSFULL_REPSONSE) return false;
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

export const getItemFromTable = async (dbClient, table, ...keys) => {
  const {
    partitionKeyName,
    partitionKeyType,
    partitionKeyValue,
    sortKeyName,
    sortKeyType,
    sortKeyValue,
  } = keys

  ketObject = {
    key: {
      partitionKeyName: {
        partitionKeyType: partitionKeyValue
      }
    }
  }

  if (sortKeyName != "") {
    ketObject.key.sortKeyName = {
      sortKeyType: sortKeyValue
    }
  }

  const params = {
    Key: keyObject,
    TableName: table,
  };
  const command = new GetItemCommand(params);
  const response = await dbClient.send(command);

  return response;
}

export const getLsoa = async (record) => {
  // use postcode to find LSOA
  // if postcode unavailable use primary_care_provider to find LSOA from Gp practice table
  const { postcode, primary_care_provider } = record

  try {
    if (postcode !== undefined) {
      const checkLsoa = await getItemFromTable(dbClient, "Postcode", "POSTCODE", "S", postcode);
      if (checkLsoa.Item === undefined) { // set using gp practice
        const lsoaFromGp = await getItemFromTable(dbClient, "gp_practice_code", "GpPractice", "S", primary_care_provider);
        return lsoaFromGp.Item.LSOA_2011.S
      }
      return checkLsoa.Item.LSOA_2011.S
    }
  } catch (err) {
    console.error(`Error trying to get LSOA from external tables.`);
    console.error(err);
    return err;
  }
}

export const formatDynamoDbRecord = (record) => {
  return {
    PutRequest: {
      Item: {
        PersonId: {S: record.participantId},
        LsoaCode: {S: record.lsoa_2011},
        participantId: {S: record.participantId}, // may need to change
        nhs_number: {N: Number(record.nhs_number)},
        superseded_by_nhs_number: {N: Number(record.superseded_by_nhs_number)},
        primary_care_provider: {S: record.primary_care_provider},
        gp_connect: {S: record.gp_connect},
        name_prefix: {S: record.name_prefix},
        given_name: {S: record.given_name},
        other_given_names: {S: record.other_given_names},
        family_name: {S: record.family_name},
        date_of_birth: {S: record.date_of_birth},
        gender: {S: record.gender},
        address_line_1: {S: record.address_line_1},
        address_line_2: {S: record.address_line_2},
        address_line_3: {S: record.address_line_3},
        address_line_4: {S: record.address_line_4},
        address_line_5: {S: record.address_line_5},
        postcode: {S: record.postcode},
        reason_for_removal: {S: record.reason_for_removal},
        reason_for_removal_effective_from_date: {S: record.reason_for_removal_effective_from_date},
        date_of_death: {S: record.date_of_death},
        telephone_number: {N: Number(record.telephone_number)},
        mobile_number: {N: Number(record.mobile_number)},
        email_address: {S: record.email_address},
        preferred_language: {S: record.preferred_language},
        is_interpreter_required: {BOOL: Boolean(record.is_interpreter_required)},
        action: {S: record.action},
      }
    }
  }
}

const uploadToDynamoDb = async (dbClient, table, batch) => {
  let requestItemsObject = {};
  requestItemsObject[`${ENVIRONMENT}-${table}`] = batch;

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject
  });

  const response = await dbClient.send(command);
  return response.$metadata.httpStatusCode;
}

export async function batchWriteRecords(records, chunkSize, dbClient) {
  console.log(`Number of records to push to db = ${records.length}`)
  const sendRequest = [];
  if (records.length === 0) return sendRequest; // handle edge case

  for (let i = 0; i < records.length; chunkSize) {
    if ((records.length - i) < chunkSize){ // remaining chunk
      const batch = records.splice(i, records.length - i);
      console.log("Writing remainder")
      sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
      return sendRequest;
    }
    const batch = records.splice(i, chunkSize);
    console.log("Writing to dynamo")
    sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
  }
  return sendRequest
}

export const generateRecord = (record, client) => {
  record.participant_id = generateParticipantID(client); // AC3
  const responsibleIcb = getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider) // AC4
  record.responsible_icb = responsibleIcb.icb_id.S;
  record.lsoa_2011 = getLsoa(record);
  return formatDynamoDbRecord(record)
}

// Not in 440
// Supplied NHS No. exists in MPI AND superseded by NHS No. == Null C)
// Supplied NHS no. exists in MPI AND superseded by NHS no. !== Null AND superseded by NHS No. exists in the MPI D)
/* Supplied NHS No/ does not exist in MPI And Superseded by NHS No. == Null A)
  - If record with NHS No DOES NOT exists in population table:
    - generate participantId
    - use primary_care_provider code to look up ICB code. Add this as responsible_ICB attribue
    - set persons LSOA
    - insert item into pop table
*/
/* Supplied NHS No. does not exist in MPI AND superseded by NHS No. !== Null AND Superseded by NHS No. does not exist in the MPI B)
  - If record with NHS No DOES NOT exists in population table && Superseded by NHS No DOES NOT exist:
    - set NHS No to Superseded by NHS No
    - generate participantId
    - use primary_care_provider code to look up ICB code. Add this as responsible_ICB attribue
    - set persons LSOA
    - insert item into pop table
*/
