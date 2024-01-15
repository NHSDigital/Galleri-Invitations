import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();

// Lambda Entry Point
export const handler = async (event) => {

  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const start = Date.now();
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);

    console.log("Split records array into unique and duplicates")
    const [
      uniqueRecordsToBatchProcess,
      duplicateRecordsToIndividuallyProcess
    ] = filterUniqueEntries(records)

    console.log(`Unique record count = ${uniqueRecordsToBatchProcess.length}, duplicate record count = ${duplicateRecordsToIndividuallyProcess.length}
    Total records = ${uniqueRecordsToBatchProcess.length + duplicateRecordsToIndividuallyProcess.length}.`)

    if (uniqueRecordsToBatchProcess.length > 0){
      let countAC1 = 0
      let countAC2 = 0

      const recordsToBatchUpload = uniqueRecordsToBatchProcess.map(async (record) => {
        return processingData(record);
      })
      const recordsToUploadSettled = await Promise.all(recordsToBatchUpload)

      // filter those who dont fall into ADD
      // those who have not been rejected
      const filteredRecordsToUploadSettled = recordsToUploadSettled.filter(record => {
        return record !== null || record?.rejectedRecordNhsNumber
      })

      const filteredRecordsToUploadSettled = [];
      const filteredRejectedRecords = [];


      const filteredRecordsToUploadSettled = recordsToUploadSettled.forEach(record => {
        return record !== null || record?.rejectedRecordNhsNumber
      })

      // DEBUG CODE
      // {
      // const stringifySuccessArray = JSON.stringify(await filteredRecordsToUploadSettled, null, 2);

      // const writeSuccessfullToFile = fs.writeFile(
      //   "./uploadDynamo.json",
      //   stringifySuccessArray,
      //   (err) => {
      //     if (err) {
      //       console.log("Error writing file", err);
      //     } else {
      //       console.log("Successfully wrote file");
      //     }
      //   }
      // );
      // }

      console.log("Successfully formatted records", filteredRecordsToUploadSettled.length)

      console.log(`#AC1 = ${countAC1}\n#AC2 = ${countAC2}`)
      const uploadRecords = await batchWriteRecords(filteredRecordsToUploadSettled, 25, client);

      console.log('----------------------------------------------------------------')
    }

    if (duplicateRecordsToIndividuallyProcess > 0){

    }

// {
//   PutRequest: {
//     Item: {
//       PersonId: {S: record.participant_id},
//       LsoaCode: {S: record.lsoa_2011},
//       participantId: {S: record.participant_id}, // may need to change
//       nhs_number: {N: record.nhs_number},
//       superseded_by_nhs_number: {N: record.superseded_by_nhs_number},
//       primary_care_provider: {S: record.primary_care_provider},
//       gp_connect: {S: record.gp_connect},
//       name_prefix: {S: record.name_prefix},
//       given_name: {S: record.given_name},
//       other_given_names: {S: record.other_given_names},
//       family_name: {S: record.family_name},
//       date_of_birth: {S: record.date_of_birth},
//       gender: {N: record.gender},
//       address_line_1: {S: record.address_line_1},
//       address_line_2: {S: record.address_line_2},
//       address_line_3: {S: record.address_line_3},
//       address_line_4: {S: record.address_line_4},
//       address_line_5: {S: record.address_line_5},
//       postcode: {S: record.postcode},
//       reason_for_removal: {S: record.reason_for_removal},
//       reason_for_removal_effective_from_date: {S: record.reason_for_removal_effective_from_date},
//       date_of_death: {S: record.date_of_death},
//       telephone_number: {N: record.telephone_number},
//       mobile_number: {N: record.mobile_number},
//       email_address: {S: record.email_address},
//       preferred_language: {S: record.preferred_language},
//       is_interpreter_required: {BOOL: Boolean(record.is_interpreter_required)},
//       action: {S: record.action},
//     }
//   }
// }

// {
//   rejectedRecordNhsNumber: record.nhs_number,
//   reason: lsoaCheck.reason
// }

// null

    // For each data chunk, read in the CSV stored in AWS S3.
    // Discard rows and columns that are not needed
    // Return an array of objects that contain the filtered data
    const gridallPromises = gridallKeys.map(async (gridallKey) => {
      const gridallCsvString = await readCsvFromS3(
        bucketName,
        gridallKey,
        client
      );
      return parseCsvToArray(gridallCsvString, processGridallRow);
    });

    // Settle all promised in array before concatenating them into single array
    const gridallDataArrayChunks = await Promise.all(gridallPromises);
    gridallCombinedData = gridallDataArrayChunks.flat();

    // Generate the CSV format
    const filteredGridallFileString = generateCsvString(
      `POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021`,
      gridallCombinedData
    );

    // Deposit to S3 bucket
    await pushCsvToS3(
      bucketName,
      "filtered_data/filteredGridallFile.csv",
      filteredGridallFileString,
      client
    );
    console.log("GRIDALL extracted: ", Date.now() - start);
  } catch (error) {
    console.error(
      "Error with Gridall extraction, procession or uploading",
      error
    );
  }

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
    console.log("Failed: ", err);
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

    console.log("Succeeded");
    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

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
// export const processingData = async (record) => {
//   const checkingNHSNumber = await checkDynamoTable(client, record.nhs_number, "Population", "nhs_number", "N", true)
//   // Supplied NHS No. exists in Population table
//   if (checkingNHSNumber){
//     if (record.superseded_by_nhs_number === 'null'){
//       ++countAC5
//       // TODO: UPDATE A RECORD
//       // return await formatDynamoDbRecord("", true)
//       return null
//     } else {
//       const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
//        // Superseded by NHS No. does not exist in the MPI
//       if (checkingSupersedNumber) {
//         ++countAC7
//         // TODO: THEN merge two MPI record
//         // return await formatDynamoDbRecord("", true)
//         return null
//       } else {
//         ++countAC6
//         // TODO: THEN replace NHS no. with the Superseded by NHS no
//         // return await formatDynamoDbRecord("", true)
//         return null
//       }
//     }
//   } else { // Supplied NHS No/ does not exist in Population table
//     if (record.superseded_by_nhs_number === 'null'){
//       ++countAC1
//       // const formattedRecord = await generateRecord(record, client);
//       return await generateRecord(record, client);
//     } else { // Superseded by NHS No. !== Null
//       const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
//       // Superseded by NHS No. does not exist in the MPI
//       if (!checkingSupersedNumber) {
//         ++countAC2
//         record.nhs_number = record.superseded_by_nhs_number;
//         // const formattedRecord = await generateRecord(record, client);
//         return await generateRecord(record, client);
//       }
//     }
//   }
// }


// takes a single data item and process it
// returns records in dynamodb format with
export const processingData = async (record) => {
  const checkingNHSNumber = await checkDynamoTable(client, record.nhs_number, "Population", "nhs_number", "N", true)
  if (!checkingNHSNumber){
     // Supplied NHS No/ does not exist in Population table
    if (record.superseded_by_nhs_number === 'null'){
      ++countAC1
      return await generateRecord(record, client);
    } else {
      const checkingSupersedNumber = await checkDynamoTable(client, record.superseded_by_nhs_number, "Population", "superseded_by_nhs_number", "N", true);
      if (!checkingSupersedNumber) {
        // Superseded by NHS No. does not exist in the MPI
        ++countAC2
        record.nhs_number = record.superseded_by_nhs_number;
        return await generateRecord(record, client);
      }
    }
  }

  return {
    rejected: true,
    reason: `Rejecting record ${record.nhs_number} the record already exists in table`
  }
}

// Not unit testing
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

export const generateRecord = async (record, client) => {
  record.participant_id = await generateParticipantID(client); // AC3
  const lsoaCheck = await getLsoa(record, client);

  if (!record.participant_id || lsoaCheck.rejected){
    return {
      rejectedRecordNhsNumber: record.nhs_number,
      reason: lsoaCheck.reason
    };
  }

  record.lsoa_2011 = lsoaCheck.lsoaCode;
  const responsibleIcb = await getItemFromTable(client, "GpPractice", "gp_practice_code", "S", record.primary_care_provider); // AC4
  record.responsible_icb = responsibleIcb.Item?.icb_id.S;
  // Records keys failed
  return await formatDynamoDbRecord(record)
}

// TODO: unit
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

// TODO: unit
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
const uploadToDynamoDb = async (dbClient, table, batch) => {
  let requestItemsObject = {};
  requestItemsObject[`${ENVIRONMENT}-${table}`] = batch;

  const command = new BatchWriteItemCommand({
    RequestItems: requestItemsObject
  });

  const response = await dbClient.send(command);
  return response.$metadata.httpStatusCode;
}

// TODO: unit
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
