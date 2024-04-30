import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  QueryCommand,
  GetItemCommand,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import RandExp from "randexp";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const client = new DynamoDBClient({
  region: "eu-west-2",
  convertEmptyValues: true,
});

const ENVIRONMENT = process.env.ENVIRONMENT;

const SUCCESSFULL_REPSONSE = 200;
const UNSUCCESSFULL_REPSONSE = 400;

let participantIdStore = {};

// Lambda Entry Point
export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);

    const [uniqueRecordsToBatchProcess, duplicateRecordsToIndividuallyProcess] =
      filterUniqueEntries(records);

    if (uniqueRecordsToBatchProcess.length > 0) {
      const recordsToBatchUpload = uniqueRecordsToBatchProcess.map(
        async (record) => {
          return processingData(record);
        }
      );
      const recordsToUploadSettled = await Promise.all(recordsToBatchUpload);

      const filteredRecordsToUploadSettled = [];
      const filteredRejectedRecords = [];

      recordsToUploadSettled.forEach((record) => {
        if (record?.rejected) {
          filteredRejectedRecords.push(record);
        } else {
          filteredRecordsToUploadSettled.push(record);
        }
      });

      if (filteredRecordsToUploadSettled) {
        console.log(
          `${filteredRecordsToUploadSettled.length} records successfully formatted`
        );
        const uploadRecords = await batchWriteRecords(
          filteredRecordsToUploadSettled,
          25,
          client
        );
        console.log(
          `uploadRecords = ${JSON.stringify(uploadRecords, null, 2)}`
        );
      }

      console.log(
        "----------------------------------------------------------------"
      );

      if (filteredRejectedRecords) {
        const timeNow = Date.now();
        const fileName = `validRecords/rejectedRecords/rejectedRecords-${timeNow}.csv`;
        console.error(
          `Error: ${filteredRejectedRecords.length} records failed. A failure report will be uploaded to ${bucket}/${fileName}`
        );
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
  } catch (error) {
    console.error(
      "Error: with CaaS Feed extraction, procession or uploading",
      error
    );
  }
  return "Exiting Lambda";
};

// METHODS
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
    console.error(`Error: Failed to read from ${bucketName}/${key}`);
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
    console.error(
      `Error: Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

export const parseCsvToArray = async (csvString) => {
  const dataArray = [];

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(row);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

// returns unique records array and an array that contains all the duplicate
export const filterUniqueEntries = (cassFeed) => {
  const flag = {};
  const unique = [];
  const duplicate = [];

  cassFeed.forEach((el) => {
    if (!flag[el.nhs_number]) {
      flag[el.nhs_number] = true;
      unique.push(el);
    } else {
      duplicate.push(el);
    }
  });
  return [unique, duplicate];
};

// returns formatted dynamodb record or rejected record object
const processingData = async (record) => {
  const checkingNHSNumber = await checkDynamoTable(
    client,
    record.nhs_number,
    "Population",
    "nhs_number",
    "N",
    true
  );
  if (!checkingNHSNumber) {
    // Supplied NHS No/ does not exist in Population table
    if (record.superseded_by_nhs_number === "null") {
      return await generateRecord(record, client);
    } else {
      const checkingSupersedNumber = await checkDynamoTable(
        client,
        record.superseded_by_nhs_number,
        "Population",
        "superseded_by_nhs_number",
        "N",
        true
      );
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
    reason: `Rejecting record ${record.nhs_number} the record already exists in table`,
  };
};

// returns true if item exists in dynamodb table
export const checkDynamoTable = async (
  dbClient,
  attribute,
  table,
  attributeName,
  attributeType,
  useIndex
) => {
  try {
    const checkTable = await lookUp(
      dbClient,
      attribute,
      table,
      attributeName,
      attributeType,
      useIndex
    );
    if (checkTable === UNSUCCESSFULL_REPSONSE) {
      return true;
    }
    return false;
  } catch (err) {
    console.error(
      `Error checking the ${attribute} in ${table} table. Error Message: ${err}`
    );
    return err;
  }
};

// returns formatted dynamodb json to be uploaded or rejected object
const generateRecord = async (record, client) => {
  record.participant_id = await generateParticipantID(client);
  const lsoaCheck = await getLsoa(record, client);

  if (!record.participant_id || lsoaCheck.rejected) {
    // Records keys failed
    return {
      rejectedRecordNhsNumber: record.nhs_number,
      rejected: true,
      reason: lsoaCheck.reason,
    };
  }
  record.lsoa_2011 = lsoaCheck;
  const responsibleIcb = await getItemFromTable(
    client,
    "GpPractice",
    "gp_practice_code",
    "S",
    record.primary_care_provider
  );
  if (!responsibleIcb.Item?.icb_id?.S) {
    return {
      rejectedRecordNhsNumber: record.nhs_number,
      rejected: true,
      reason: `GP practice with code ${record.primary_care_provider} is not part of a participating ICB`,
    };
  }
  record.responsible_icb = responsibleIcb.Item.icb_id.S;
  return await formatDynamoDbRecord(record);
};

// returns unique participant id using NHS regex
// unique in both population table and this stream
export const generateParticipantID = async (dbClient) => {
  const participantIdRandExp = new RandExp(
    /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/
  );
  try {
    let participantId;
    let found = UNSUCCESSFULL_REPSONSE;
    do {
      participantId = participantIdRandExp.gen();
      found = await lookUp(
        dbClient,
        participantId,
        "Population",
        "participantId",
        "S",
        true
      );
    } while (
      found !== SUCCESSFULL_REPSONSE &&
      !participantIdStore.hasOwnProperty(participantId)
    );
    participantIdStore.participantId = true;
    return participantId;
  } catch (err) {
    console.error(`Error: generating participant id. Error Message: ${err}`);
    return err;
  }
};

// returns LSOA using patient postcode or the LSOA from GP practice
// or returns error message
export const getLsoa = async (record, dbClient) => {
  const { postcode, primary_care_provider } = record;
  const lsoaObject = {
    lsoaCode: "",
    rejected: false,
    reason: "",
  };

  try {
    if (postcode) {
      const checkLsoa = await getItemFromTable(
        dbClient,
        "Postcode",
        "POSTCODE",
        "S",
        postcode
      );
      // Get LSOA using GP practice
      if (!checkLsoa.Item) {
        const lsoaFromGp = await getItemFromTable(
          dbClient,
          "GpPractice",
          "gp_practice_code",
          "S",
          primary_care_provider
        );
        // LSOA code could not be found for record using postcode or gp practice code. Set as null
        if (!lsoaFromGp.Item || lsoaFromGp.Item.LSOA_2011.S === "")
          return (lsoaObject.lsoaCode = "null");
        return (lsoaObject.lsoaCode = lsoaFromGp.Item.LSOA_2011.S);
      }
      if (checkLsoa.Item.LSOA_2011.S !== "")
        return (lsoaObject.lsoaCode = checkLsoa.Item.LSOA_2011.S);
      lsoaObject.rejected = true;
      lsoaObject.reason = `Rejecting record ${record.nhs_number} as Postcode is not in participating ICB`;
      return lsoaObject;
    } else {
      lsoaObject.rejected = true;
      lsoaObject.reason = `Rejecting record ${record.nhs_number} as Postcode is undefined`;
      return lsoaObject;
    }
  } catch (err) {
    console.error(
      `Error: trying to get LSOA from external tables. Error Message: ${err}`
    );
    return err;
  }
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
  ] = keys;

  let partitionKeyNameObject = {};
  let partitionKeyNameNestedObject = {};
  partitionKeyNameNestedObject[partitionKeyType] = partitionKeyValue;
  partitionKeyNameObject[partitionKeyName] = partitionKeyNameNestedObject;

  const keyObject = {
    key: partitionKeyNameObject,
  };

  if (sortKeyName !== undefined) {
    keyObject.key.sortKeyName = {
      sortKeyType: sortKeyValue,
    };
  }

  const params = {
    Key: partitionKeyNameObject,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  const command = new GetItemCommand(params);
  const response = await dbClient.send(command);
  return response;
};

// returns successful response if attribute doesn't exist in table
export const lookUp = async (dbClient, ...params) => {
  const [id, table, attribute, attributeType, useIndex] = params;

  const ExpressionAttributeValuesKey = `:${attribute}`;
  let expressionAttributeValuesObj = {};
  let expressionAttributeValuesNestObj = {};

  expressionAttributeValuesNestObj[attributeType] = id;
  expressionAttributeValuesObj[ExpressionAttributeValuesKey] =
    expressionAttributeValuesNestObj;

  const input = {
    ExpressionAttributeValues: expressionAttributeValuesObj,
    KeyConditionExpression: `${attribute} = :${attribute}`,
    ProjectionExpression: `${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) {
    if (attribute === "participantId") {
      input.IndexName = `Participant_Id-index`;
    } else {
      input.IndexName = `${attribute}-index`;
    }
  }

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.Items.length > 0) {
    // attribute already exists in table
    return UNSUCCESSFULL_REPSONSE;
  }
  return SUCCESSFULL_REPSONSE;
};

// returns response from batch write to dynamodb table
export const uploadToDynamoDb = async (dbClient, table, batch) => {
  let requestItemsObject = {};
  requestItemsObject[`${ENVIRONMENT}-${table}`] = batch;

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject,
  });

  const response = await dbClient.send(command);
  return response.$metadata.httpStatusCode;
};

// returns array with each element representing response of batch upload status
export async function batchWriteRecords(records, chunkSize, dbClient) {
  console.log(`Number of records to push to db = ${records.length}`);
  const sendRequest = [];
  // handle edge case
  if (records.length === 0) return sendRequest;

  for (let i = 0; i < records.length; chunkSize) {
    if (records.length - i < chunkSize) {
      // remaining chunk
      const batch = records.splice(i, records.length - i);
      console.log("Writing remainder");
      sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
      return sendRequest;
    }
    const batch = records.splice(i, chunkSize);
    console.log("Writing to dynamo");
    sendRequest.push(await uploadToDynamoDb(dbClient, `Population`, batch));
  }
  return sendRequest;
}

// returns formatted dynamodb json to be uploaded
export const formatDynamoDbRecord = async (record) => {
  // nhs_number: {N: record.nhs_number}, -> 0
  if (record.nhs_number === "null") record.nhs_number = "0";
  // superseded_by_nhs_number: {N: record.superseded_by_nhs_number}, -> 0
  if (record.superseded_by_nhs_number === "null")
    record.superseded_by_nhs_number = "0";
  // gender: {N: record.gender}, -> -1
  if (record.gender === "null") record.gender = "-1";
  // telephone_number: {S: record.telephone_number}, -> 0
  if (record.telephone_number === "null") record.telephone_number = "0";
  // mobile_number: {S: record.mobile_number}, -> 0
  if (record.mobile_number === "null") record.mobile_number = "0";

  return {
    PutRequest: {
      Item: {
        PersonId: { S: record.participant_id },
        LsoaCode: { S: record.lsoa_2011 },
        participantId: { S: record.participant_id },
        nhs_number: { N: record.nhs_number },
        superseded_by_nhs_number: { N: record.superseded_by_nhs_number },
        primary_care_provider: { S: record.primary_care_provider },
        gp_connect: { S: record.gp_connect },
        name_prefix: { S: record.name_prefix },
        given_name: { S: record.given_name },
        other_given_names: { S: record.other_given_names },
        family_name: { S: record.family_name },
        date_of_birth: { S: record.date_of_birth },
        gender: { N: record.gender },
        address_line_1: { S: record.address_line_1 },
        address_line_2: { S: record.address_line_2 },
        address_line_3: { S: record.address_line_3 },
        address_line_4: { S: record.address_line_4 },
        address_line_5: { S: record.address_line_5 },
        postcode: { S: record.postcode },
        reason_for_removal: { S: record.reason_for_removal },
        reason_for_removal_effective_from_date: {
          S: record.reason_for_removal_effective_from_date,
        },
        responsible_icb: { S: record.responsible_icb },
        date_of_death: { S: record.date_of_death },
        telephone_number: { S: record.telephone_number },
        mobile_number: { S: record.mobile_number },
        email_address: { S: record.email_address },
        preferred_language: { S: record.preferred_language },
        is_interpreter_required: {
          BOOL: Boolean(record.is_interpreter_required),
        },
        Invited: { S: "false" },
        identified_to_be_invited: { BOOL: false },
        action: { S: record.action },
      },
    },
  };
};

// returns string to upload to s3
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};
