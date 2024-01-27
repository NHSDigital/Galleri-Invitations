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

  // const bucket = event.Records[0].s3.bucket.name;
  // const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  // console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const bucket = `dev-2-galleri-caas-data`;
  const key = `validRecords/valid_records_update-3.csv`;
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  // try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);

    const [
      uniqueRecordsToBatchProcess,
      duplicateRecordsToIndividuallyProcess
    ] = filterUniqueEntries(records);

    if (uniqueRecordsToBatchProcess.length > 0){
      const recordsToBatchUpload = uniqueRecordsToBatchProcess.map(async (record) => {
        // GIVEN the supplied NHS No. does exist in MPI, get the entire record from the table
        let tableRecord;
        if(record.nhs_number) tableRecord = await lookUp(client, record.nhs_number, "Population", "nhs_number", "N", true);

        // nhs_number-index needs to return ALL items of record
        if (tableRecord?.Items.length > 0){
          // console.log(`NHS Number queried = ${record.nhs_number}`)
          return processingData(record, tableRecord.Items[0]);
        } else {
          return {
            rejectedRecordNhsNumber: record.nhs_number,
            rejected: true,
            reason: `Rejecting record ${record.nhs_number}. Cannot update record as it doesn't exist in table`
          }
        }
      });

      const recordsToUploadSettled = await Promise.all(recordsToBatchUpload);

      const filteredRejectedRecords = [];

      recordsToUploadSettled.forEach(record => {
        if (!record?.rejected) filteredRejectedRecords.push(record)
      });

      console.log('----------------------------------------------------------------');

      if (filteredRejectedRecords) {
        console.log(`filteredRejectedRecords = ${JSON.stringify(filteredRejectedRecords)}`)
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
          `${ENVIRONMENT}-${bucket}`,
          `${fileName}`,
          rejectedRecordsString,
          s3
        );
      }
    }
  // }
  // catch (error) {
  //   console.error(
  //     "Error with CaaS Feed extraction, procession or uploading",
  //     error
  //   );
  // }
  return "Exiting Lambda";
};

// METHODS
// returns formatted dynamodb record or rejected record object
const processingData = async (record, tableRecord) => {
  if (record.superseded_by_nhs_number === 'null') {
    // console.log(`Updating record ${record.nhs_number}`);
    return await updateRecord(record, tableRecord);
  } else {
    // AC5
    if (!tableRecord.superseded_by_nhs_number) {
      // superseded by NHS No. does not exist in the MPI
      const {
        personId,
        lsoaCode
      } = tableRecord
      // THEN replace NHS no. with the Superseded by NHS no
      const updateSuperseededId = ["superseded_by_nhs_number", "N", record.superseded_by_nhs_number]
      return await updateRecordInTable(client, "Population", personId, "PersonId", lsoaCode, "LsoaCode", updateSuperseededId);
    }
  }
}

/* need a to create test data such that:
  - date of death change but no open record -> DONE. 5558001216
  - date of death change WITH open record -> DONE. Record 5558008113 and  NHS-DM72-ES61 for this
  - primary care provider changed to something that is in participating ICB -> DONE. 5558001216
  - post code change to in participating ICB -> DONE. 5558008113
*/
const updateRecord = async (record, recordFromTable) => {
  const {
    PersonId,
    LsoaCode
  } = recordFromTable

  if (record.nhs_number === "5558001216" || record.nhs_number === "5558008113" || record.nhs_number === "5558001216" || record.nhs_number === "5558008113" ){
    console.log(`For record ${record.nhs_number}, PersonId = ${PersonId.S} and LsoaCode = ${LsoaCode.S}`)
  }
  // AC1b -> 5558008113
  if (record.date_of_death !== recordFromTable.date_of_death) {
    // update record in population table
    // check if open record
    // AC1a
    if (record.nhs_number === "5558001216" || record.nhs_number === "5558008113"){
      console.log(`In date_of_death`)
    }
    const episodeRecord = await lookUp(client, PersonId.S, "Episode", "Participant_Id", "S", true);
    if (episodeRecord?.Items.length > 0) {
      // close record in population table
      const batchId = episodeRecord.Items[0].Batch_Id.S
      const participantId = episodeRecord.Items[0].Participant_Id.S

      console.log(`For record ${record.nhs_number} | batchId = ${batchId} and participantId = ${participantId}`)


      const updateEpisodeRecord = ["Episode_Status", "S", "Closed"]
      await updateRecordInTable(client, "Episode", batchId, "Batch_Id", participantId, "Participant_Id", updateEpisodeRecord);
    }
    // update record with new date_of_death
    const updateDateOfDeath = ["date_of_death", "S", record.date_of_death];
    await updateRecordInTable(client, "Population", PersonId.S, "PersonId", LsoaCode.S, "LsoaCode", updateDateOfDeath);
  }

  // AC2 -> 5558001216
  if (record.primary_care_provider !== recordFromTable.primary_care_provider) {
    // set the personId for the incoming data item
    record.participant_id = PersonId.S;
    // responsible icb and lsoa
    const lsoaCheck = await getLsoa(record, client);

    if (lsoaCheck.rejected) {
      // Records keys failed
      return {
        rejectedRecordNhsNumber: record.nhs_number,
        rejected: true,
        reason: lsoaCheck.reason
      };
    }
    record.lsoa_2011 = lsoaCheck;
    const responsibleIcb = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider);
    record.responsible_icb = responsibleIcb.Item?.icb_id.S;
    console.log(`for record ${record.nhs_number}, the responsible icb found = ${responsibleIcb.Item?.icb_id.S} and lsoa found = ${lsoaCheck} for primary care provide = ${record.primary_care_provider}`)

    // overwrite record with new primary_care_provider && responsible_ICB && LSOA
    await overwriteRecordInTable(client, "Population", record, recordFromTable);
  }

  // AC4 -> 5558008113
  if (record.postcode !== recordFromTable.postcode) {
    // set the personId for the incoming data item
    record.participant_id = PersonId.S;
    // set lsoa
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


    console.log(`for record ${record.nhs_number}, the lsoa found = ${lsoaCheck} for postcode = ${record.postcode}. Should be E-123-ABC`)

    // overwrite record with new postcode && LSOA
    await overwriteRecordInTable(client, "Population", record, recordFromTable);
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
    updateItemCommandExpressionAttributeValuesNested [`${itemType}`] = item ;
    updateItemCommandExpressionAttributeValues[`:${localItemName}`] = updateItemCommandExpressionAttributeValuesNested

    // UpdateExpression
    if (index > 0){
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

  console.log(`logging update command for ${JSON.stringify(input, null, 2)}`);

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

    console.log(`Put Item: ${JSON.stringify(input, null, 2)}`)

    const command = new PutItemCommand(input);
    const response = await client.send(command);

    return response;
}

// returns LSOA using patient postcode or the LSOA from GP practice
// or returns error message
export const getLsoa = async (record, dbClient) => {
  const { postcode, primary_care_provider } = record
  console.log(`for record ${record.nhs_number}, the postcode = ${postcode} and the primary_care_provider = ${primary_care_provider}`)
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
        // LSOA code could not be found for record using postcode or gp practice code. Set as null
        if (!lsoaFromGp.Item || lsoaFromGp.Item.LSOA_2011.S === "") return lsoaObject.lsoaCode = "null";
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

  // if (attribute === "Participant_Id"){
  //   console.log("params = ", params)
  //   console.log(`look up item input = ${JSON.stringify(input, null, 2)}`)
  // }

  // if (attribute === "nhs_number"){
  //   console.log(`look up item input = ${JSON.stringify(input, null, 2)}`)
  // }
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
