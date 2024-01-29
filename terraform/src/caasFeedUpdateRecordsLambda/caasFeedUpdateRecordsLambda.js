import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const client = new DynamoDBClient({ region: "eu-west-2", convertEmptyValues: true });

const ENVIRONMENT = process.env.ENVIRONMENT


// Lambda Entry Point
export const handler = async (event) => {

  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);

    const [
      uniqueRecordsToBatchProcess,
      duplicateRecordsToIndividuallyProcess
    ] = filterUniqueEntries(records);

    if (uniqueRecordsToBatchProcess.length > 0){
      const recordsToUploadSettled = await Promise.allSettled(
        uniqueRecordsToBatchProcess.map(async (record) => {
          // GIVEN the supplied NHS No. does exist in MPI, get the entire record from the table
          let tableRecord;
          if(record.nhs_number) tableRecord = await lookUp(client, record.nhs_number, "Population", "nhs_number", "N", true);

          if (tableRecord?.Items.length > 0){
            return processingData(record, tableRecord.Items[0]);
          } else {
            return {
              rejectedRecordNhsNumber: record.nhs_number,
              rejected: true,
              reason: `Rejecting record ${record.nhs_number}. Cannot update record as it doesn't exist in table`
            }
          }
        })
      );

      const filteredRejectedRecords = recordsToUploadSettled.filter((record) => { return !record?.rejected });

      console.log('----------------------------------------------------------------');

      if (filteredRejectedRecords) {
        const timeNow = Date.now();
        const fileName = `validRecords/rejectedRecords/update/rejectedRecords-${timeNow}.csv`
        console.log(`${filteredRejectedRecords.length} records failed. A failure report will be uploaded to ${ENVIRONMENT}-${bucket}/${fileName}`);
        // Generate the CSV format
        const rejectedRecordsString = generateCsvString(
          `nhs_number,rejected,reason`,
          filteredRejectedRecords
        );

        // Deposit to S3 bucket
        await pushCsvToS3(
          `${bucket}`,
          `${fileName}`,
          rejectedRecordsString,
          s3
        );
      }
    }
  }
  catch (error) {
    console.error(
      "Error with CaaS Feed extraction, procession or uploading",
      error
    );
  }
  return "Exiting Lambda";
};

// METHODS

// takes incoming record and record from table and compares the two
export const processingData = async (record, tableRecord) => {
  if (record.superseded_by_nhs_number === 'null' || record.superseded_by_nhs_number == 0) { // superseded_by_nhs_number is a Number type thus 0 === null
    return await updateRecord(record, tableRecord); // AC1, 2, 4
  } else {
    if (!tableRecord.superseded_by_nhs_number) {
      // superseded by NHS No. does not exist in the MPI
      // THEN replace NHS no. with the Superseded by NHS no
      record.nhs_number = record.superseded_by_nhs_number
      await overwriteRecordInTable(client, "Population", record, tableRecord);
      return {
        rejected: false
      }
    }
  }
}

const updateRecord = async (record, recordFromTable) => {
  const { PersonId } = recordFromTable

  if (record.date_of_death !== recordFromTable.date_of_death) { // AC1a and AC1b
    const episodeRecord = await lookUp(client, PersonId.S, "Episode", "Participant_Id", "S", true);
    // close open Episode record
    if (episodeRecord?.Items.length > 0) {
      const batchId = episodeRecord.Items[0].Batch_Id.S
      const participantId = episodeRecord.Items[0].Participant_Id.S

      const updateEpisodeRecord = ["Episode_Status", "S", "Closed"]
      await updateRecordInTable(client, "Episode", batchId, "Batch_Id", participantId, "Participant_Id", updateEpisodeRecord);
    } else {
      console.log('No open Episode record')
    }
  }

  if (record.primary_care_provider !== recordFromTable.primary_care_provider) { // AC2
    record.participant_id = PersonId.S;

    const lsoaCheck = await getLsoa(record, client);
    if (lsoaCheck.rejected) {
      return {
        rejectedRecordNhsNumber: record.nhs_number,
        rejected: true,
        reason: lsoaCheck.reason
      };
    }
    record.lsoa_2011 = lsoaCheck;

    const responsibleIcb = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider);
    record.responsible_icb = responsibleIcb.Item?.icb_id.S;

    if (!record.responsible_icb) {
      return {
        rejectedRecordNhsNumber: record.nhs_number,
        rejected: true,
        reason: `Rejecting record ${record.nhs_number} as could not find ICB in participating ICB for GP Practice code ${record.primary_care_provider}`
      };
    }
  }

  if (record.postcode !== recordFromTable.postcode) { //AC43
    record.participant_id = PersonId.S;

    const lsoaCheck = await getLsoa(record, client);
    if (!record.participant_id || lsoaCheck.rejected){
      return {
        rejectedRecordNhsNumber: record.nhs_number,
        rejected: true,
        reason: lsoaCheck.reason
      };
    }
    record.lsoa_2011 = lsoaCheck;
  }

  await overwriteRecordInTable(client, "Population", record, recordFromTable);
  return {
    rejected: false
  }
}

export async function updateRecordInTable(client, table, partitionKey, partitionKeyName, sortKey, sortKeyName, ...itemsToUpdate) {

  let updateItemCommandKey = {}
  updateItemCommandKey[partitionKeyName] = { S: `${partitionKey}` }
  updateItemCommandKey[sortKeyName] = { S: `${sortKey}`}

  let updateItemCommandExpressionAttributeNames = {}

  let updateItemCommandExpressionAttributeValues = {}

  let updateItemCommandExpressionAttributeValuesNested = {}

  let updateItemCommandUpdateExpression = `SET `

  itemsToUpdate.forEach((updateItem, index) => {
    const [
      itemName,
      itemType,
      item
    ] = updateItem

    // ExpressionAttributeNames
    const localAttributeName = `#${itemName.toUpperCase()}`
    updateItemCommandExpressionAttributeNames[localAttributeName] = itemName;

    const localItemName = `local_${itemName}`

    // ExpressionAttributeValues
    updateItemCommandExpressionAttributeValuesNested = {...updateItemCommandExpressionAttributeValuesNested,
      [itemType] : item
    };
    updateItemCommandExpressionAttributeValues[`:${localItemName}`] = updateItemCommandExpressionAttributeValuesNested

    // UpdateExpression
    if (index > 0) {
      updateItemCommandUpdateExpression += `,${localAttributeName} = :${localItemName}`
    } else {
      updateItemCommandUpdateExpression += `${localAttributeName} = :${localItemName}`
    }
  })

  const input = {
    ExpressionAttributeNames: updateItemCommandExpressionAttributeNames,
    ExpressionAttributeValues: updateItemCommandExpressionAttributeValues,
    Key: updateItemCommandKey,
    TableName: `${ENVIRONMENT}-${table}`,
    UpdateExpression: updateItemCommandUpdateExpression,
  };


  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  if ((response.$metadata.httpStatusCode) != 200){
    console.log(`record update failed for person ${partitionKey}`);
  }
  return response.$metadata.httpStatusCode;
}

export async function overwriteRecordInTable(client, table, newRecord, oldRecord) {
  const deleteOldItem = await deleteTableRecord(client, table, oldRecord);

  if (deleteOldItem.$metadata.httpStatusCode === 200){
    const updateNewItem = await putTableRecord(client, table, newRecord);
    return updateNewItem.$metadata.httpStatusCode;
  }
}

export async function deleteTableRecord(client, table, oldRecord) {
  const {
    PersonId,
    LsoaCode
  } = oldRecord

  const input =
    {
      Key: {
        PersonId: {S: PersonId.S},
        LsoaCode: {S: LsoaCode.S}
      },
      TableName: `${ENVIRONMENT}-${table}`
    }

  const command = new DeleteItemCommand(input);
  const response = await client.send(command);

  return response;
}

export async function putTableRecord(client, table, newRecord) {
    // nhs_number: {N: newRecord.nhs_number}, -> 0
    if (newRecord.nhs_number === "null") newRecord.nhs_number = "0"
    // superseded_by_nhs_number: {N: newRecord.superseded_by_nhs_number}, -> 0
    if (newRecord.superseded_by_nhs_number === "null") newRecord.superseded_by_nhs_number = "0"
    // gender: {N: newRecord.gender}, -> -1
    if (newRecord.gender === "null") newRecord.gender = "-1"
    // telephone_number: {N: newRecord.telephone_number}, -> 0
    if (newRecord.telephone_number === "null") newRecord.telephone_number = "0"
    // mobile_number: {N: newRecord.mobile_number}, -> 0
    if (newRecord.mobile_number === "null") newRecord.mobile_number = "0"

    const input = {
      Item: {
        PersonId: {S: newRecord.participant_id},
        LsoaCode: {S: newRecord.lsoa_2011},
        participantId: {S: newRecord.participant_id},
        nhs_number: {N: newRecord.nhs_number},
        superseded_by_nhs_number: {N: newRecord.superseded_by_nhs_number},
        primary_care_provider: {S: newRecord.primary_care_provider},
        gp_connect: {S: newRecord.gp_connect},
        name_prefix: {S: newRecord.name_prefix},
        given_name: {S: newRecord.given_name},
        other_given_names: {S: newRecord.other_given_names},
        family_name: {S: newRecord.family_name},
        date_of_birth: {S: newRecord.date_of_birth},
        gender: {N: newRecord.gender},
        address_line_1: {S: newRecord.address_line_1},
        address_line_2: {S: newRecord.address_line_2},
        address_line_3: {S: newRecord.address_line_3},
        address_line_4: {S: newRecord.address_line_4},
        address_line_5: {S: newRecord.address_line_5},
        postcode: {S: newRecord.postcode},
        reason_for_removal: {S: newRecord.reason_for_removal},
        reason_for_removal_effective_from_date: {S: newRecord.reason_for_removal_effective_from_date},
        responsible_icb: {S: newRecord.responsible_icb},
        date_of_death: {S: newRecord.date_of_death},
        telephone_number: {N: newRecord.telephone_number},
        mobile_number: {N: newRecord.mobile_number},
        email_address: {S: newRecord.email_address},
        preferred_language: {S: newRecord.preferred_language},
        is_interpreter_required: {BOOL: Boolean(newRecord.is_interpreter_required)},
        action: {S: newRecord.action},
      },
      TableName: `${ENVIRONMENT}-${table}`
    }

    const command = new PutItemCommand(input);
    const response = await client.send(command);

    return response;
}

// returns LSOA using patient postcode or the LSOA from GP practice
// or returns error message
export const getLsoa = async (record, dbClient) => {
  const { postcode, primary_care_provider } = record
  const lsoaObject = {
    lsoaCode: "",
    rejected: false,
    reason: ""
  }

  try {
    if (postcode) {
      const checkLsoa = await getItemFromTable(dbClient, "Postcode", "POSTCODE", "S", postcode);
      if (!checkLsoa.Item) {
      // Get LSOA using GP practice
        const lsoaFromGp = await getItemFromTable(dbClient, "GpPractice", "gp_practice_code", "S", primary_care_provider);
        // LSOA code could not be found for record using postcode or gp practice code. Set as null
        if (!lsoaFromGp.Item || lsoaFromGp.Item.LSOA_2011.S === "") {
          return lsoaObject.lsoaCode = "null"
        };

        return lsoaObject.lsoaCode = lsoaFromGp.Item.LSOA_2011.S;
      }

      if (checkLsoa.Item.LSOA_2011.S !== "") {
        return lsoaObject.lsoaCode = checkLsoa.Item.LSOA_2011.S
      };

      lsoaObject.rejected = true;
      lsoaObject.reason = `Rejecting record ${record.nhs_number} as Postcode ${postcode} is not in participating ICB`;
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

// returns unique records array and an array that contains all the duplicate
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

// S3 FUNCTIONS
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

// returns string to upload to s3
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

// DYNAMODB FUNCTIONS
// returns successful response if attribute doesn't exist in table
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

  if (useIndex) {
    input.IndexName = `${attribute}-index`;
    if (table === 'Population') {
      input.ProjectionExpression = `PersonId, date_of_death, LsoaCode, postcode, primary_care_provider`;
    }
    if (table === 'Episode') {
      input.ProjectionExpression = `Batch_Id, Participant_Id`;
    }
  }

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.$metadata.httpStatusCode != 200){
    console.log(`look up item input = ${JSON.stringify(input, null, 2)}`)
  }

  return response;
};

// returns item and metadata from dynamodb table
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
