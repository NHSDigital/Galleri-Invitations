import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();

const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * Lambda handler function to process CSV files from S3 and perform validation checks.
 *
 * @function handler
 * @async
 * @param {Object} event - The Lambda event object containing S3 event details.
 * @throws {Error}
 */
export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  const slicedKey = key.slice(16, -4);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);
    if (!records.length) {
      throw new Error(`The file ${key} in bucket ${bucket} is empty`);
    }

    const [outputSuccess, outputUnsuccess] = validateRecords(records);
    console.log(`Finished validating object ${key} in bucket ${bucket}`);
    console.log(
      "----------------------------------------------------------------"
    );

    console.log(
      "Start Filtering the successful Validated records and split into 3 arrays. ADD, UPDATE and DELETE array "
    );

    // Valid Records Arrangement
    const [recordsAdd, recordsUpdate, recordsDelete] =
      filterRecordStatus(outputSuccess);
    const recordsAddCsvData = convertArrayOfObjectsToCSV(recordsAdd);
    const recordsUpdateCsvData = convertArrayOfObjectsToCSV(recordsUpdate);
    const recordsDeleteCsvData = convertArrayOfObjectsToCSV(recordsDelete);

    // InValid Records Arrangement
    const invalidRecordsCsvData = convertArrayOfObjectsToCSV(outputUnsuccess);

    console.log(
      `Pushing filtered valid records and invalid records to their respective sub-folder in bucket ${bucket}`
    );

    // Deposit to S3 bucket
    if (recordsAddCsvData.length > 0) {
      await pushCsvToS3(
        `${ENVIRONMENT}-galleri-processed-caas-data`,
        `validRecords/valid_records_add-${slicedKey}.csv`,
        recordsAddCsvData,
        s3
      );
    } else {
      console.log("No data to push for valid Records with action - ADD");
    }

    if (recordsUpdateCsvData.length > 0) {
      await pushCsvToS3(
        `${ENVIRONMENT}-galleri-processed-caas-data`,
        `validRecords/valid_records_update-${slicedKey}.csv`,
        recordsUpdateCsvData,
        s3
      );
    } else {
      console.log("No data to push for valid Records with action - UPDATE");
    }

    if (recordsDeleteCsvData.length > 0) {
      await pushCsvToS3(
        `${ENVIRONMENT}-galleri-processed-caas-data`,
        `validRecords/valid_records_delete-${slicedKey}.csv`,
        recordsDeleteCsvData,
        s3
      );
    } else {
      console.log("No data to push for valid Records with action - DELETE");
    }

    if (invalidRecordsCsvData.length > 0) {
      await pushCsvToS3(
        `${ENVIRONMENT}-galleri-processed-caas-data`,
        `invalidRecords/invalid_records-${slicedKey}.csv`,
        invalidRecordsCsvData,
        s3
      );
    } else {
      console.log("No invalid records to push in the bucket");
    }

    // Logging the invalid records
    if (outputUnsuccess.length > 0) {
      console.error(
        `Error: PLEASE FIND THE INVALID CAAS RECORDS FROM THE PROCESSED CAAS FEED in the file here:
        ${ENVIRONMENT}-galleri-processed-caas-data/invalidRecords/invalid_records-${slicedKey}.csv`
      );
    } else {
      console.log("NO INVALID RECORDS FOUND IN THE PROCESSED CAAS FEED");
    }

    return `Finished validating object ${key} in bucket ${bucket}`;
  } catch (err) {
    const message = `Error: processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  }
};

/**
 * Retrieves a CSV file from S3.
 *
 * @function readCsvFromS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {Object} client - The S3 client.
 * @returns {Promise<string>} - A promise that resolves to the CSV file content.
 * @throws {Error} Will throw an error if reading from S3 fails.
 */
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

/**
 * Pushes a CSV file to S3.
 *
 * @function pushCsvToS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the S3 object.
 * @param {string} body - The content of the CSV file.
 * @param {Object} client - The S3 client.
 * @returns {Promise<Object>} - A promise that resolves to the S3 response.
 * @throws {Error} Will throw an error if pushing to S3 fails.
 */
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
    console.error(
      `Error: Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

/**
 * Parses a CSV string into an array of objects.
 *
 * @function parseCsvToArray
 * @async
 * @param {string} csvString - The CSV string to parse.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of objects.
 * @throws Will throw an error if parsing the CSV fails.
 */
export const parseCsvToArray = async (csvString) => {
  console.log("Parsing csv string");
  const dataArray = [];
  let row_counter = 0;

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        row_counter++;
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

/**
 * Converts an array of objects into a CSV format.
 *
 * @function convertArrayOfObjectsToCSV
 * @param {Array<Object>} data - The array of objects to be converted.
 * @returns {string} - The CSV formatted string.
 */
export const convertArrayOfObjectsToCSV = (data) => {
  const csvContent = [];

  //reporting Error for not an array
  if (!Array.isArray(data)) {
    console.error("Error: Data is not an array");
    return "";
  }
  if (data.length === 0) {
    console.info("Data is empty");
    return "";
  }

  // Extracting headers
  const headers = Object.keys(data[0]);
  csvContent.push(headers.join(","));

  // Extracting values
  data.forEach((item) => {
    const values = headers.map((header) => {
      const escapedValue = item[header].includes(",")
        ? `"${item[header]}"`
        : item[header];
      // blanks are removed and column needs to be quoted if it contains other whitespace,`,` or `"`.
      if (escapedValue.replace(/ /g, "").match(/[\s,"]/)) {
        return '"' + escapedValue.replace(/"/g, '""') + '"';
      }
      return escapedValue;
    });
    csvContent.push(values.join(","));
  });

  return csvContent.join("\n");
};

/**
 * Validates records and separates them into successful and unsuccessful categories.
 *
 * @function validateRecords
 * @param {Array<Object>} records - The array of records to be validated.
 * @returns {Array<Array<Object>>} - An array containing two arrays: successful and unsuccessful records.
 */
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

/**
 * Validates a single record.
 *
 * @function validateRecord
 * @param {Object} record - The record to be validated.
 * @returns {Object} - An object containing the validation results (success and message).
 */
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

  //GAL-1237 - when primary care provider is blank
  if (record.primary_care_provider.trim().length === 0) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - GP Practice code contain blank values";
    return validationResults;
  }

  // AC6 - Both the Primary Care Provider and the Reason for Removal fields contain values (other than null) OR Both the Primary Care Provider and the Reason for Removal fields contain null values
  if (record.action != "DEL") {
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
  }

  if (
    (record.name_prefix !== "null" &&
      !isValidNameFormat(record.name_prefix, 35, 2)) ||
    record.name_prefix === ""
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Name Prefix is missing";
    return validationResults;
  }

  // AC9 - Given Name not provided
  if (
    (record.given_name !== "null" &&
      !isValidNameFormat(record.given_name, 35, 2)) ||
    record.given_name === ""
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Given Name is missing";
    return validationResults;
  }

  // AC8 - Family Name not provided
  if (
    (record.family_name !== "null" &&
      !isValidNameFormat(record.family_name, 35, 2)) ||
    record.family_name === ""
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Family Name is missing";
    return validationResults;
  }

  if (
    (record.other_given_names !== "null" &&
      !isValidNameFormat(record.other_given_names, 100, 1)) ||
    record.other_given_names === ""
  ) {
    validationResults.success = false;
    validationResults.message = "Technical error - Other given name is missing";
    return validationResults;
  }
  // AC7 - Date of Birth is an invalid format or is in the future
  if (
    record.action != "DEL" &&
    (!record.date_of_birth ||
      !isValidDateFormatOrInTheFuture(record.date_of_birth))
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - Date of Birth is invalid or missing";
    return validationResults;
  }

  // AC3 - Missing or Invalid Gender provided
  if (record.action != "DEL" && !isValidGender(record.gender)) {
    validationResults.success = false;
    validationResults.message = "Technical error - Missing or invalid Gender";
    return validationResults;
  }

  // AC?? - postcode is not supplied
  if (
    record.action != "DEL" &&
    (!record.postcode || record.postcode === "null")
  ) {
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

  //GAL-1366
  if (
    record.action != "DEL" &&
    (record.is_interpreter_required === null ||
      record.is_interpreter_required.trim().length === 0)
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - is_interpreter_required is invalid";
    return validationResults;
  }
  return validationResults;
}

/**
 * Checks if an NHS number is in a valid format.
 *
 * @function isValidNHSNumberFormat
 * @param {string} nhsNumber - The NHS number to be validated.
 * @returns {boolean} - A boolean indicating whether the NHS number is in a valid format.
 */
export function isValidNHSNumberFormat(nhsNumber) {
  // AC1 - NHS Number is not a valid format (n10),
  // check if it's a numeric string with a length of 10
  return /^\d{10}$/.test(nhsNumber);
}

/**
 * Checks if a name has a valid format.
 *
 * @function isValidNameFormat
 * @param {string} given_name - The name to be validated.
 * @param {number} limit - The character limit for the name.
 * @param {number} flag - A flag indicating the type of name validation.
 * @returns {boolean} - A boolean indicating whether the name has a valid format.
 */
export function isValidNameFormat(given_name, limit, flag) {
  //Check Valid name format
  const isValidFormat = /^[\wŽžÀ-ÿ ,.\-']+$/gim.test(given_name);
  const otherNameValidFormat = /^[\wŽžÀ-ÿ ,.'\-|]+$/gim.test(given_name);
  if (given_name.split("").length > limit) {
    return false;
  }
  if (flag === 1) {
    if (!otherNameValidFormat) {
      return false;
    } else {
      return true;
    }
  } else if (flag === 2) {
    //all other name checks
    if (!isValidFormat) {
      return false; //Invalid format
    } else {
      return true;
    }
  }
}

/**
 * Checks if a reason for removal code is valid.
 *
 * @function isValidRemovalReasonCode
 * @param {string} reasonCode - The reason for removal code to be validated.
 * @returns {boolean} - A boolean indicating whether the reason for removal code is valid.
 */
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

/**
 * Checks if a gender value is valid.
 *
 * @function isValidGender
 * @param {string} gender - The gender value to be validated.
 * @returns {boolean} - A boolean indicating whether the gender value is valid.
 */
export function isValidGender(gender) {
  // AC3 - Missing or Invalid Gender provided
  // check if it's one of the specified valid values
  return ["0", "1", "2", "9"].includes(gender);
}

/**
 * Checks if a date has a valid format.
 *
 * @function isValidDateFormat
 * @param {string} dateString - The date string to be validated.
 * @returns {boolean} - A boolean indicating whether the date string has a valid format.
 */
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

/**
 * Checks if a date has a valid format and is not in the future.
 *
 * @function isValidDateFormatOrInTheFuture
 * @param {string} dateString - The date string to be validated.
 * @returns {boolean} - A boolean indicating whether the date string has a valid format and is not in the future.
 */
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

/**
 * Checks if an action value is valid.
 *
 * @function isValidAction
 * @param {string} action - The action value to be validated.
 * @returns {boolean} - A boolean indicating whether the action value is valid.
 */
export function isValidAction(action) {
  // AC3 - Missing or Invalid Gender provided
  // check if it's one of the specified valid values
  return ["ADD", "DEL", "UPDATE"].includes(action);
}

/**
 * Filters records based on their action status arrays - ADD, UPDATE and DELETE array.
 *
 * @function filterRecordStatus
 * @param {Array<Object>} records - The array of records to be filtered.
 * @returns {Array<Array<Object>>} - An array containing three arrays: ADD, UPDATE, and DELETE.
 */
export const filterRecordStatus = (records) => {
  const recordsAdd = [];
  const recordsUpdate = [];
  const recordsDelete = [];

  records.forEach((el) => {
    if (el.action === "ADD") {
      recordsAdd.push(el);
    } else if (el.action === "UPDATE") {
      recordsUpdate.push(el);
    } else if (el.action === "DEL") {
      recordsDelete.push(el);
    }
  });

  return [recordsAdd, recordsUpdate, recordsDelete];
};
