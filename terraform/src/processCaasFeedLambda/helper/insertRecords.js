import records from "./successfullyValidatedCassFeedArray.json" assert { type: "json" };
import RandExp from 'randexp'
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  BatchWriteItemCommand
} from "@aws-sdk/client-dynamodb";

const SUCCESSFULL_REPSONSE = 200
const UNSUCCESSFULL_REPSONSE = 400

const client = new DynamoDBClient({ region: "eu-west-2", convertEmptyValues: true });
// const recordsToUpload = [];
let ENVIRONMENT = process.env.ENVIRONMENT // change to const
ENVIRONMENT = "dev-2"

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
    let found = UNSUCCESSFULL_REPSONSE;
    do {
      participantId = participantIdRandExp.gen();
      // console.log("Checking if participantId exists in Population table")
      found = await lookUp(dbClient, participantId, "Population", "participantId", "S", true);
    } while (found !== SUCCESSFULL_REPSONSE);
    // console.log(`participantId = ${participantId}`)
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};

export const checkDynamoTable = async (dbClient, attribute, table, attributeName, attributeType, useIndex) => {
  try {
    const checkTable = await lookUp(dbClient, attribute, table, attributeName, attributeType, useIndex);
    // console.log(`what is the response from checking the ${table} for attribute ${attributeName} with value ${attribute} -> ${checkTable}`)
    if (checkTable === UNSUCCESSFULL_REPSONSE) {
      return true
    };
    return false;
  } catch (err) {
    console.error(`Error checking the ${attribute} in ${table} table.`);
    console.error(err);
    return err;
  }
}

export const lookUp = async (dbClient, ...params) => {
  const [
    id,
    table,
    attribute,
    attributeType,
    useIndex
   ] = params
  // console.log("lookup params: ", ...params)

  const ExpressionAttributeValuesKey = `:${attribute}`
  let expressionAttributeValuesObj = {}
  let expressionAttributeValuesNestObj = {}

  expressionAttributeValuesNestObj[attributeType] = id
  expressionAttributeValuesObj[ExpressionAttributeValuesKey] = expressionAttributeValuesNestObj


  const input = {
    ExpressionAttributeValues: expressionAttributeValuesObj,
    KeyConditionExpression: `${attribute} = :${attribute}`,
    ProjectionExpression: `${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) input.IndexName = `${attribute}-index`

  // console.log(JSON.stringify(input, null, 2))

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);


  if(id == 5558028009){
    // console.log(response.Items.length)
  }

  if (response.Items.length > 0){
    return UNSUCCESSFULL_REPSONSE; // participatingId already exists
  }
  return SUCCESSFULL_REPSONSE;
};

export const getItemFromTable = async (dbClient, table, ...keys) => {
  const [
    partitionKeyName,
    partitionKeyType,
    partitionKeyValue,
    sortKeyName,
    sortKeyType,
    sortKeyValue,
   ] = keys


  let partitionKeyNameObject = {}
  let partitionKeyNameNestedObject = {}
  partitionKeyNameNestedObject[partitionKeyType] = partitionKeyValue
  partitionKeyNameObject[partitionKeyName] = partitionKeyNameNestedObject

  const keyObject = {
    key: partitionKeyNameObject
  }

  if (sortKeyName !== undefined) {
    keyObject.key.sortKeyName = {
      sortKeyType: sortKeyValue
    }
  }

  const params = {
    Key: partitionKeyNameObject,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  // console.log(`Get ${partitionKeyName} = ${partitionKeyValue} from ${table} table using`)
  // console.log(params)
  const command = new GetItemCommand(params);
  const response = await dbClient.send(command);
  // console.log(response)
  return response;
}

export const getLsoa = async (record) => {
  // use postcode to find LSOA
  // if postcode unavailable use primary_care_provider to find LSOA from Gp practice table
  const { postcode, primary_care_provider } = record
  // console.log(postcode, primary_care_provider)

  try {
    if (postcode) {
      // console.log(`Using postcode to search for lsoa ${postcode}`);
      const checkLsoa = await getItemFromTable(client, "Postcode", "POSTCODE", "S", postcode);
      if (!checkLsoa.Item) { // set using gp practice
        // console.log(`Couldn't find LSOA using postcode ${postcode}, trying to find the LSOA from GpPractice = ${primary_care_provider}`);
        const lsoaFromGp = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", primary_care_provider);
        if (!lsoaFromGp.Item || lsoaFromGp.Item.LSOA_2011.S === "") {
          console.log(`Rejecting record ${record.nhs_number} as cant get LSOA from the GP practice with code ${primary_care_provider} as it is not part of participating ICB`)
          record.reject = true
          return undefined
        }
        // console.log(`nhsNo = ${record.nhs_number} | check LSOA from GP ${JSON.stringify(lsoaFromGp, null, 2)}`)
        return lsoaFromGp.Item.LSOA_2011.S
      }
      // console.log(`nhsNo = ${record.nhs_number} | check LSOA from POSTCODE ${JSON.stringify(checkLsoa, null, 2)}`)
      if (checkLsoa.Item.LSOA_2011.S !== "") return checkLsoa.Item.LSOA_2011.S
      console.log(`Rejecting record ${record.nhs_number} as Postcode is not in participating ICB`)
      record.reject = true
      return undefined;
    } else {
      console.log(`Rejecting record ${record.nhs_number} as Postcode is undefined`)
      record.reject = true
      return undefined;
    }
  } catch (err) {
    console.error(`Error trying to get LSOA from external tables.`);
    console.error(err);
    return err;
  }
}

export const formatDynamoDbRecord = async (record) => {
  if (record.reject) {
    return {
      PutRequest: {
        Item: {
          PersonId: {S: ""},
          LsoaCode: {S: ""},
        }
      }
    }
  }

  // nhs_number: {N: record.nhs_number}, -> 0
  if (record.nhs_number === "null") record.nhs_number = "0"
  // superseded_by_nhs_number: {N: record.superseded_by_nhs_number}, -> 0
  if (record.superseded_by_nhs_number === "null") record.superseded_by_nhs_number = "0"
  // gender: {N: record.gender}, -> -1
  if (record.gender === "null") record.gender = "-1"
  // telephone_number: {N: record.telephone_number}, -> 0
  if (record.telephone_number === "null") record.telephone_number = "0"
  // mobile_number: {N: record.mobile_number}, -> 0
  if (record.mobile_number === "null") record.mobile_number = "0"

  return {
    PutRequest: {
      Item: {
        PersonId: {S: record.participant_id},
        LsoaCode: {S: record.lsoa_2011},
        participantId: {S: record.participant_id}, // may need to change
        nhs_number: {N: record.nhs_number},
        superseded_by_nhs_number: {N: record.superseded_by_nhs_number},
        primary_care_provider: {S: record.primary_care_provider},
        gp_connect: {S: record.gp_connect},
        name_prefix: {S: record.name_prefix},
        given_name: {S: record.given_name},
        other_given_names: {S: record.other_given_names},
        family_name: {S: record.family_name},
        date_of_birth: {S: record.date_of_birth},
        gender: {N: record.gender},
        address_line_1: {S: record.address_line_1},
        address_line_2: {S: record.address_line_2},
        address_line_3: {S: record.address_line_3},
        address_line_4: {S: record.address_line_4},
        address_line_5: {S: record.address_line_5},
        postcode: {S: record.postcode},
        reason_for_removal: {S: record.reason_for_removal},
        reason_for_removal_effective_from_date: {S: record.reason_for_removal_effective_from_date},
        date_of_death: {S: record.date_of_death},
        telephone_number: {N: record.telephone_number},
        mobile_number: {N: record.mobile_number},
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
  // console.log("Writing:", JSON.stringify(records, null, 2))
  console.log(`Number of records to push to db = ${records.length}`)
  const sendRequest = [];
  if (records.length === 0) return sendRequest; // handle edge case

  for (let i = 0; i < records.length; chunkSize) {
    if ((records.length - i) < chunkSize){ // remaining chunk
      const batch = records.splice(i, records.length - i);
      console.log("Writing remainder")
      // , JSON.stringify(batch, null, 2))
      sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
      return sendRequest;
    }
    const batch = records.splice(i, chunkSize);
    console.log("Writing to dynamo")
    sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
  }
  return sendRequest
}

export const generateRecord = async (record, client) => {
  record.participant_id = await generateParticipantID(client); // AC3
  const responsibleIcb = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider) // AC4
  // console.log(`record.nhs_number ${record.nhs_number} | responsibleIcb for GpPractice ${record.primary_care_provider} =  ${JSON.stringify(responsibleIcb.Item?.icb_id)}`);
  record.responsible_icb = responsibleIcb.Item?.icb_id.S;
  record.lsoa_2011 = await getLsoa(record);
  return await formatDynamoDbRecord(record)
}

// ENTRY POINT
console.log("records.length", records.length)

const recordsToUpload = records.map(async (record) => {
  const checkingNHSNumber = await checkDynamoTable(client, record.nhs_number, "Population", "nhs_number", "N", true)
  if (checkingNHSNumber){ // Supplied NHS No. exists in Population table
    // console.log("NHS Number exists in Population table")
    if (record.superseded_by_nhs_number === 'null'){ // Superseded by NHS No. == Null ---> C)
      console.log("A5")
      return await formatDynamoDbRecord("", true)
      // ---- C ---- AC5
    } else { // Superseded by NHS No. !== Null
      const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
      // console.log(`checkingSupersedNumber = ${checkingSupersedNumber}`);
      if (!checkingSupersedNumber) { // Superseded by NHS No. does not exist in the MPI ---> D)
        console.log("AC6")
        return await formatDynamoDbRecord("", true)
        // ---- D ---- AC6
      }
    }
    return "NHS Number exists in Population table"
  } else { // Supplied NHS No/ does not exist in Population table
    // console.log("NHS Number does not exist in Population table")
    if (record.superseded_by_nhs_number === 'null'){ // Superseded by NHS No. == Null --> A)
      // ---- A ---- AC1
      // console.log("AC1")
      const formattedRecord = await generateRecord(record, client);
      return formattedRecord;
    } else { // Superseded by NHS No. !== Null
      const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
      // console.log(`checkingSupersedNumber = ${checkingSupersedNumber}`);
      if (!checkingSupersedNumber) { // Superseded by NHS No. does not exist in the MPI ---> B)
        // ---- B ---- AC2
        console.log("AC2")
        record.nhs_number = record.superseded_by_nhs_number;
        const formattedRecord = await generateRecord(record, client);
        return formattedRecord;
      }
    }
  }
})

const recordsToUploadSettled = await Promise.all(recordsToUpload)

console.log("Printing records to upload", recordsToUploadSettled.length)
// recordsToUploadSettled.forEach(record => {
//   console.log(`nsh number = ${JSON.stringify(record.PutRequest.Item.nhs_number)} | participatingId = ${JSON.stringify(record.PutRequest.Item.participantId)} | lsoa = ${JSON.stringify(record.PutRequest.Item.lsoa_2011)}`)
// })



// filter those who dont have lsoacode or  participantId
const filteredRecordsToUploadSettled = recordsToUploadSettled.filter(record => {
  // console.log("record.PutRequest.Item.PersonId.S = " + record.PutRequest?.Item?.PersonId.S + " record.PutRequest.Item.LsoaCode.S = " + record.PutRequest?.Item?.LsoaCode.S)
  return record.PutRequest?.Item?.PersonId.S !== "" && record.PutRequest?.Item?.LsoaCode.S !== ""
})

console.log('----------------------------------------------------------------')

console.log("Printing records to upload FILTERED", filteredRecordsToUploadSettled.length)

const uploadRecords = await batchWriteRecords(filteredRecordsToUploadSettled, 25, client);
