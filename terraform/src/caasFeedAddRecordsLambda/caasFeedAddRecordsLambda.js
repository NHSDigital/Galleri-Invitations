import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  BatchWriteItemCommand
} from "@aws-sdk/client-dynamodb";
import RandExp from 'randexp'
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const client = new DynamoDBClient({ region: "eu-west-2", convertEmptyValues: true });
let ENVIRONMENT = process.env.ENVIRONMENT
const SUCCESSFULL_REPSONSE = 200
const UNSUCCESSFULL_REPSONSE = 400

// Lambda Entry Point
export const handler = async (event) => {

  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const start = Date.now();
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);

    const [
      uniqueRecordsToBatchProcess,
      duplicateRecordsToIndividuallyProcess
    ] = filterUniqueEntries(records);

    console.log(`Unique record count = ${uniqueRecordsToBatchProcess.length}, duplicate record count = ${duplicateRecordsToIndividuallyProcess.length}
    Total records = ${uniqueRecordsToBatchProcess.length + duplicateRecordsToIndividuallyProcess.length}.`);

    if (uniqueRecordsToBatchProcess.length > 0){

      const recordsToBatchUpload = uniqueRecordsToBatchProcess.map(async (record) => {
        return processingData(record);
      });
      const recordsToUploadSettled = await Promise.all(recordsToBatchUpload);


      const filteredRecordsToUploadSettled = [];
      const filteredRejectedRecords = [];


      recordsToUploadSettled.forEach(record => {
        if (record?.rejected){
          filteredRejectedRecords.push(record);
        } else {
          console.log("processed record = ", JSON.stringify(record, null, 2));
          filteredRecordsToUploadSettled.push(record);
        }
      });

      if (filteredRecordsToUploadSettled){
        console.log(`${filteredRecordsToUploadSettled.length} records successfully formatted`);
        const uploadRecords = await batchWriteRecords(filteredRecordsToUploadSettled, 25, client);
        console.log(`uploadRecords = ${JSON.stringify(uploadRecords, null, 2)}`);
      }

      console.log('----------------------------------------------------------------');

      if (filteredRejectedRecords) {
        const timeNow = Date.now();
        console.log(`${filteredRejectedRecords.length} records failed. A failure report will be uploaded to ${ENVIRONMENT}-galleri-validated-caas-data/rejectedRecords/rejectedRecords-${timeNow}.csv`);
        // Generate the CSV format
        const rejectedRecordsString = generateCsvString(
          `nhs_number,rejected,reason`,
          filteredRejectedRecords
        );

        // Deposit to S3 bucket
        await pushCsvToS3(
          `${ENVIRONMENT}-galleri-validated-caas-data`,
          `rejectedRecords/rejectedRecords-${timeNow}.csv`,
          rejectedRecordsString,
          s3
        );
      }
    }
  } catch (error) {
    console.error(
      "Error with CaaS Feed extraction, procession or uploading",
      error
    );
  }

  return "Exiting Lambda";
};

// METHODS
// TESTED
export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    return response.Body.transformToString();
  } catch (err) {
    console.log(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

// TESTED
export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log(`Failed to push to ${bucketName}/${key}. Error Message: ${err}`);
    throw err;
  }
};

// TESTED
// Takes Csv data read in from the S3 bucket and applies a processFunction
// to the data to generate an array of filtered objects
export const parseCsvToArray = async (csvString) => {
  const dataArray = [];

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(row)
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

// TESTED
// this function will split the incoming validated cass feed into
// two array, a unique array and an array that contains all the duplicate
// records
export const filterUniqueEntries = (cassFeed) => {
  const flag = {};
  const unique = [];
  const duplicate = [];

  cassFeed.forEach(el => {
    if (!flag[el.nhs_number]){
      flag[el.nhs_number] = true
      unique.push(el)
    } else {
      duplicate.push(el)
    }
  })
  return [unique, duplicate]
}

// takes a single data item and process it
// returns records in dynamodb format with
const processingData = async (record) => {
  const checkingNHSNumber = await checkDynamoTable(client, record.nhs_number, "Population", "nhs_number", "N", true)
  if (!checkingNHSNumber){
    // Supplied NHS No/ does not exist in Population table
    if (record.superseded_by_nhs_number === 'null'){
      return await generateRecord(record, client);
    } else {
      const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
      if (!checkingSupersedNumber) {
        // Superseded by NHS No. does not exist in the MPI
        record.nhs_number = record.superseded_by_nhs_number;
        return await generateRecord(record, client);
      }
    }
  }

  return {
    rejectedRecordNhsNumber: record.nhs_number,
    rejected: true,
    reason: `Rejecting record ${record.nhs_number} the record already exists in table`
  }
}

// TESTED
export const checkDynamoTable = async (dbClient, attribute, table, attributeName, attributeType, useIndex) => {
  try {
    const checkTable = await lookUp(dbClient, attribute, table, attributeName, attributeType, useIndex);
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

const generateRecord = async (record, client) => {
  record.participant_id = await generateParticipantID(client); // AC3
  const lsoaCheck = await getLsoa(record, client);

  if (!record.participant_id || lsoaCheck.rejected){
    // Records keys failed
    return {
      rejectedRecordNhsNumber: record.nhs_number,
      rejected: true,
      reason: lsoaCheck.reason
    };
  }
  record.lsoa_2011 = lsoaCheck;
  const responsibleIcb = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider); // AC4
  record.responsible_icb = responsibleIcb.Item?.icb_id.S;
  return await formatDynamoDbRecord(record)
}

// TESTED
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
      found = await lookUp(dbClient, participantId, "Population", "participantId", "S", true);
    } while (found !== SUCCESSFULL_REPSONSE);
    return participantId;
  } catch (err) {
    console.error("Error generating participant id.");
    console.error(err);
    return err;
  }
};

// Not unit testing
export const getLsoa = async (record, dbClient) => {
  // use postcode to find LSOA
  // if postcode unavailable use primary_care_provider to find LSOA from Gp practice table
  const { postcode, primary_care_provider } = record
  const lsoaObject = {
    lsoaCode: "",
    rejected: false,
    reason: ""
  }

  try {
    if (postcode) {
      const checkLsoa = await getItemFromTable(dbClient, "Postcode", "POSTCODE", "S", postcode);
      // Get LSOA using GP practice
      if (!checkLsoa.Item) {
        const lsoaFromGp = await getItemFromTable(dbClient, "GpPractice", "gp_practice_code", "S", primary_care_provider);
        if (!lsoaFromGp.Item || lsoaFromGp.Item.LSOA_2011.S === "") {
          lsoaObject.rejected = true;
          lsoaObject.reason = `Rejecting record ${record.nhs_number} as can't get LSOA from the GP practice with code ${primary_care_provider} as it is not part of participating ICB`;
          return lsoaObject;
        }
        return lsoaObject.lsoaCode = lsoaFromGp.Item.LSOA_2011.S;
      }
      if (checkLsoa.Item.LSOA_2011.S !== "") return lsoaObject.lsoaCode = checkLsoa.Item.LSOA_2011.S;
      lsoaObject.rejected = true;
      lsoaObject.reason = `Rejecting record ${record.nhs_number} as Postcode is not in participating ICB`;
      return lsoaObject;
    } else {
      lsoaObject.rejected = true;
      lsoaObject.reason = `Rejecting record ${record.nhs_number} as Postcode is undefined`
      return lsoaObject;
    }
  } catch (err) {
    console.error(`Error trying to get LSOA from external tables.`);
    console.error(err);
    return err;
  }
}

// TESTED
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

  const command = new GetItemCommand(params);
  const response = await dbClient.send(command);
  return response;
}

// TESTED
export const lookUp = async (dbClient, ...params) => {
  const [
    id,
    table,
    attribute,
    attributeType,
    useIndex
  ] = params


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

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.Items.length > 0){
    return UNSUCCESSFULL_REPSONSE; // participatingId already exists
  }
  return SUCCESSFULL_REPSONSE;
};

// TESTED
export const uploadToDynamoDb = async (dbClient, table, batch) => {
  let requestItemsObject = {};
  requestItemsObject[`${ENVIRONMENT}-${table}`] = batch;

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject
  });

  const response = await dbClient.send(command);
  return response.$metadata.httpStatusCode;
}

// TESTED
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

// TESTED
export const formatDynamoDbRecord = async (record) => {
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

// Concatenates header and data into single string - the format S3 looks for
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};
