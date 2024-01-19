import records from "./helper/caasFeedArray.json" assert { type: "json" };
import {
  ListObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";
// import fs from "fs";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const BUCKET_NAME = process.env.BUCKET_NAME;


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
export const parseCsvToArray = async (csvString, processFunction) => {
  const dataArray = [];
  let row_counter = 0;
  let participating_counter = 0;

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        row_counter++;
        participating_counter = processFunction(
          dataArray,
          row,
          participating_counter
        );
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const handler = async () => {
  // const records = event.records;
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const dataArray = await parseCsvToArray(csvString);
    await saveArrayToTable(dataArray, ENVIRONMENT, dbClient);
    console.log(`Finished processing object ${key} in bucket ${bucket}`);
    return `Finished processing object ${key} in bucket ${bucket}`;
  } catch (err) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${err}`;
    console.error(message);
    throw new Error(message);
  };

  if (!records) {
    return {
      statusCode: 400,
      body: JSON.stringify({}),
    };
  }

  const [outputSuccess, outputUnsuccess] = validateRecords(records);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: outputSuccess,
      unsuccessful: outputUnsuccess,
    }),
  };
};



// For now, The function iterates through the records .
// The iteration will be removed later as this will be a Helper method
// for a Lambda function which will iterate through the records
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

  // AC9 - Given Name not provided
  if (!record.given_name || record.given_name === "null" || record.given_name.trim() === "") {
    validationResults.success = false;
    validationResults.message = "Technical error - Given Name is missing";
    return validationResults;
  }

  // AC8 - Family Name not provided
  if (!record.family_name || record.family_name === "null" || record.family_name.trim() === "") {
    validationResults.success = false;
    validationResults.message = "Technical error - Family Name is missing";
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

  // Commented out for now as BA are waiting to confirm the AC and the test data provided does not contain the field
  // AC11 - The supplied invalid flag field does not contain a valid value ('True' or False) - await spec outcome and revisit AC
  // if (record.invalid_flag !== 'True' && record.invalid_flag !== 'False') {
  //   validationResults.success = false;
  //   validationResults.message = 'Technical error - The Invalid Flag received does not contain a valid value';
  //   return validationResults;
  // }

  // Potential AC?? - Reason for Removal Business Effective From Date is an invalid format
  if (
    record.reason_for_removal_effective_from_date !== "null" &&
    !isValidDateFormat(record.reason_for_removal_effective_from_date)
  ) {
    validationResults.success = false;
    validationResults.message =
      "Technical error - Reason for Removal Business Effective From Date is invalid";
    return validationResults;
  }

  return validationResults;
}

export function isValidNHSNumberFormat(nhsNumber) {
  // AC1 - NHS Number is not a valid format (n10),
  // check if it's a numeric string with a length of 10
  return /^\d{10}$/.test(nhsNumber);
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

const [outputSuccess, outputUnsuccess] = validateRecords(records);

// const stringifySuccessArray = JSON.stringify(outputSuccess, null, 2);
// const stringifyUnsuccessArray = JSON.stringify(outputUnsuccess, null, 2);

// const writeSuccessfullToFile = fs.writeFile(
//   "./successfullyValidatedCassFeedArray.json",
//   stringifySuccessArray,
//   (err) => {
//     if (err) {
//       console.log("Error writing file", err);
//     } else {
//       console.log("Successfully wrote file");
//     }
//   }
// );

// const writeUnsuccessfullToFile = fs.writeFile(
//   "./unsuccessfullyValidatedCassFeedArray.json",
//   stringifyUnsuccessArray,
//   (err) => {
//     if (err) {
//       console.log("Error writing file", err);
//     } else {
//       console.log("Successfully wrote file");
//     }
//   }
// );

console.log('Successful Records:', outputSuccess.length) // check first 10 items in array
console.log('Unsuccessful Records:', outputUnsuccess.length) // check first 10 items in array