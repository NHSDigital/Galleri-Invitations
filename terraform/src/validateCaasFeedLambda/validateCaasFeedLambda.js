import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();

const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);
    console.log(records);

    const [outputSuccess, outputUnsuccess] = validateRecords(records);
    console.log(`Finished validating object ${key} in bucket ${bucket}`);
    console.log('----------------------------------------------------------------');

    console.log('Start Filtering the successful Validated records and split into 3 arrays. ADD, UPDATE and DELETE array ');

    //Timestamp
    const timeNow = Date.now();

    // Valid Records Arrangement
    const [recordsAdd, recordsUpdate, recordsDelete] = filterRecordStatus(outputSuccess);
    const recordsAddCsvData = convertArrayOfObjectsToCSV(recordsAdd);
    const recordsUpdateCsvData = convertArrayOfObjectsToCSV(recordsUpdate);
    const recordsDeleteCsvData = convertArrayOfObjectsToCSV(recordsDelete);

    // InValid Records Arrangement
    const invalidRecordsCsvData = convertArrayOfObjectsToCSV(outputUnsuccess);

    console.log(`Pushing filtered valid records and invalid records to their respective sub-folder in bucket ${bucket}`);

    // Deposit to S3 bucket
    await pushCsvToS3(`${ENVIRONMENT}-galleri-processed-caas-data`, `validRecords/valid_records_add-${timeNow}.csv`, recordsAddCsvData, s3);
    await pushCsvToS3(`${ENVIRONMENT}-galleri-processed-caas-data`, `validRecords/valid_records_update-${timeNow}.csv`, recordsUpdateCsvData, s3);
    await pushCsvToS3(`${ENVIRONMENT}-galleri-processed-caas-data`, `validRecords/valid_records_delete-${timeNow}.csv`, recordsDeleteCsvData, s3);

    await pushCsvToS3(`${ENVIRONMENT}-galleri-processed-caas-data`, `invalidRecords/invalid_records-${timeNow}.csv`, invalidRecordsCsvData, s3);

    // Logging the invalid records
    console.warn("PLEASE FIND THE INVALID CAAS RECORDS FROM THE PROCESSED CAAS FEED BELOW:\n" + JSON.stringify(outputUnsuccess, null, 2))

    return `Finished validating object ${key} in bucket ${bucket}`;

  } catch (err) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  };
};


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

// Takes Csv data read in from the S3 bucket to generate an array of filtered objects
export const parseCsvToArray = async (csvString) => {
  console.log('Parsing csv string');
  const dataArray = [];
  let row_counter = 0;

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        row_counter++;
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

export const convertArrayOfObjectsToCSV = (data) => {
  const csvContent = [];

  if (!Array.isArray(data) || data.length === 0) {
    console.error('Data is empty or not an array.');
    return '';
  }

  // Extracting headers
  const headers = Object.keys(data[0]);
  csvContent.push(headers.join(','));

  // Extracting values
  data.forEach((item) => {
    const values = headers.map((header) => {
      const escapedValue = item[header].includes(',')
        ? `"${item[header]}"`
        : item[header];
      return escapedValue;
    });
    csvContent.push(values.join(','));
  });

  return csvContent.join('\n');
}

// Main Validation function which will iterate through the records
export default function validateRecords(records) {
  const outputSuccess = [];
  const outputUnsuccess = [];

  records.forEach((record) => {
    const validationResult = validateRecord(record);

    if (validationResult.success) {
      outputSuccess.push({
        message: "Validation successful",
        ...record,
      });
    } else {
      outputUnsuccess.push({
        message: validationResult.message,
        ...record,
      });
    }
  });

  return [outputSuccess, outputUnsuccess];
}

export function validateRecord(record) {
  const validationResults = {
    success: true,
    message: "success",
  };

  // The validation order follows the order of the fields instead of ACs

  // AC1 - NHS Number is not a valid format (n10)
  if (!isValidNHSNumberFormat(record.nhs_number)) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - NHS number was not supplied in a valid format";
    return validationResults;
  }

  // AC2 - The Superseded by NHS number is not a valid format (n10)
  if (
    record.superseded_by_nhs_number !== "null" &&
    !isValidNHSNumberFormat(record.superseded_by_nhs_number)
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - The Superseded by NHS number was not supplied in a valid format";
    return validationResults;
  }

  // AC6 - Both the Primary Care Provider and the Reason for Removal fields contain values (other than null) OR Both the Primary Care Provider and the Reason for Removal fields contain null values
  if (
    (record.primary_care_provider !== "null" &&
      record.reason_for_removal !== "null") ||
    (record.primary_care_provider === "null" &&
      record.reason_for_removal === "null")
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - GP Practice code and Reason for Removal fields contain incompatible values";
    return validationResults;
  }

  if ((record.name_prefix !== "null" && !isValidNameFormat(record.name_prefix, 35, 2)) || (record.name_prefix === "")) {
    validationResults.success = false;
    validationResults.message = "Technical error - Name Prefix is missing";
    return validationResults;
  }

  // AC9 - Given Name not provided
  if ((record.given_name !== "null" && !isValidNameFormat(record.given_name, 35, 2)) || (record.given_name === "")) {
    validationResults.success = false;
    validationResults.message = "Technical error - Given Name is missing";
    return validationResults;
  }

  // AC8 - Family Name not provided
  if ((record.family_name !== "null" && !isValidNameFormat(record.family_name, 35, 2)) || (record.family_name === "")) {
    validationResults.success = false;
    validationResults.message = "Technical error - Family Name is missing";
    return validationResults;
  }

  if ((record.other_given_names !== "null" && !isValidNameFormat(record.other_given_names, 100, 1)) || (record.other_given_names === "")) {
    validationResults.success = false;
    validationResults.message = "Technical error - Other given name is missing";
    return validationResults;
  }
  // AC7 - Date of Birth is an invalid format or is in the future
  if (
    !record.date_of_birth ||
    !isValidDateFormatOrInTheFuture(record.date_of_birth)
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - Date of Birth is invalid or missing";
    return validationResults;
  }

  // AC3 - Missing or Invalid Gender provided
  if (!isValidGender(record.gender)) {
    validationResults.success = false;
    validationResults.message = "Technical error - Missing or invalid Gender";
    return validationResults;
  }

  // AC?? - postcode is not supplied
  if (!record.postcode || record.postcode === "null") {
    validationResults.success = false;
    validationResults.message = "Technical error - Postcode was not supplied";
    return validationResults;
  }

  // AC4 - Incorrect Reason for Removal code provided (if supplied)
  if (
    record.reason_for_removal !== "null" &&
    !isValidRemovalReasonCode(record.reason_for_removal)
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Invalid reason for removal";
    return validationResults;
  }

  // AC10 - Date of Death (if supplied is invalid format or is in the future
  if (
    record.date_of_death !== "null" &&
    !isValidDateFormatOrInTheFuture(record.date_of_death)
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Date of Death is invalid";
    return validationResults;
  }

  // Potential AC - Reason for Removal Business Effective From Date is an invalid format
  if (
    record.reason_for_removal_effective_from_date !== "null" &&
    !isValidDateFormat(record.reason_for_removal_effective_from_date)
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - Reason for Removal Business Effective From Date is invalid";
    return validationResults;
  }

  // AC12 – Action output not provided (ADD/DEL/UPDATE)
  if (!isValidAction(record.action)) {
    validationResults.success = false;
    validationResults.message = "Technical error - Action is invalid";
    return validationResults;
  }

  return validationResults;
}

export function isValidNHSNumberFormat(nhsNumber) {
  // AC1 - NHS Number is not a valid format (n10),
  // check if it's a numeric string with a length of 10
  return /^\d{10}$/.test(nhsNumber);
}

export function isValidNameFormat(given_name, limit, flag) {
  //Check Valid name format
  const isValidFormat = /^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-_]+$/gim.test(given_name);
  const otherNameValidFormat = /^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-_|]+$/gim.test(given_name);
  if (given_name.split("").length > limit) {
    return false;
  }
  if (flag === 1) {
    if (!otherNameValidFormat) {
      return false;
    } else {
      return true;
    }
  } else if (flag === 2) { //all other name checks
    if (!isValidFormat) {
      return false; //Invalid format
    } else {
      return true;
    }
  }
}

export function isValidRemovalReasonCode(reasonCode) {
  // AC4 - Incorrect Reason for Removal code provided (if supplied)
  // check if it's one of the specified valid codes
  const validCodes = [
    "AFL",
    "AFN",
    "CGA",
    "DEA",
    "DIS",
    "EMB",
    "LDN",
    "NIT",
    "OPA",
    "ORR",
    "RDI",
    "RDR",
    "RFI",
    "RPR",
    "SCT",
    "SDL",
    "SDN",
    "TRA",
  ];
  return validCodes.includes(reasonCode);
}

export function isValidGender(gender) {
  // AC3 - Missing or Invalid Gender provided
  // check if it's one of the specified valid values
  return ["0", "1", "2", "9"].includes(gender);
}

export function isValidDateFormat(dateString) {
  // AC7 - Date of Birth is an invalid format or is in the future
  // AC10 - Date of Death (if supplied is invalid format or is in the future

  // Check if the date is in a valid format
  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateString);

  if (!isValidFormat) {
    return false; // Invalid format
  }

  return true;
}

export function isValidDateFormatOrInTheFuture(dateString) {
  // AC7 - Date of Birth is an invalid format or is in the future
  // AC10 - Date of Death (if supplied is invalid format or is in the future

  // Check if the date is in a valid format
  const isValidFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateString);

  if (!isValidFormat) {
    return false; // Invalid format
  }

  const inputDate = new Date(dateString);

  // Check if the parsed date is a valid date
  if (isNaN(inputDate.getTime())) {
    return false;
  }

  // Get the current date
  const currentDate = new Date();

  // Check if the date is in the future
  if (inputDate > currentDate) {
    return false; // Date is in the future
  }

  return true;
}

export function isValidAction(action) {
  // AC3 - Missing or Invalid Gender provided
  // check if it's one of the specified valid values
  return ["ADD", "DEL", "UPDATE"].includes(action);
}

//Spread records into 3 arrays. ADD, UPDATE and DELETE array
export const filterRecordStatus = (records) => {
  const recordsAdd = []
  const recordsUpdate = []
  const recordsDelete = []

  records.forEach(el => {
    if (el.action === "ADD") {
      recordsAdd.push(el)
    } else if (el.action === "UPDATE") {
      recordsUpdate.push(el)
    } else if (el.action === "DEL") {
      recordsDelete.push(el)
    }
  })

  return [recordsAdd, recordsUpdate, recordsDelete]
};
