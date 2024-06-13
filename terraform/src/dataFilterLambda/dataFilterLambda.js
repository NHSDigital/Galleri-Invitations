import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const GALLERI_ONS_BUCKET_NAME = `${process.env.ENVIRONMENT}-${process.env.BUCKET_NAME}`;
const GRIDALL_CHUNK_1 = process.env.GRIDALL_CHUNK_1;
const GRIDALL_CHUNK_2 = process.env.GRIDALL_CHUNK_2;
const GRIDALL_CHUNK_3 = process.env.GRIDALL_CHUNK_3;

const participatingIcbs = new Set([
  "QE1",
  "QWO",
  "QOQ",
  "QF7",
  "QHG",
  "QM7",
  "QH8",
  "QMJ",
  "QMF",
  "QRV",
  "QWE",
  "QT6",
  "QJK",
  "QOX",
  "QUY",
  "QVV",
  "QR1",
  "QSL",
  "QRL",
  "QU9",
  "QNQ",
  "QXU",
  "QNX",
]);

/**
 * Reads a CSV file from S3.
 * @async
 * @function readCsvFromS3
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the object in the S3 bucket.
 * @param {S3Client} client Instance of S3 client
 * @throws {Error} Failed to read from ${bucketName}/${key}
 * @returns {string} The data of the file you retrieved
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
    console.log("Failed: ", err);
    throw err;
  }
};

/**
 * This function is used to write a new object in S3
 *
 * @async
 * @function pushCsvToS3
 * @param {string} bucketName The name of the bucket you are pushing to
 * @param {string} body The data you will be writing to S3
 * @param {string} key The name you want to give to the file you will write to S3
 * @param {S3Client} client Instance of S3 client
 * @throws {Error} Error pushing CSV to S3 bucket
 * @returns {Object} metadata about the response, including httpStatusCode
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
    console.log("Failed: ", err);
    throw err;
  }
};

/**
 * Processes Csv data read in from the S3 bucket and applies a processFunction
 * each row of data, and generates an array of filtered objects.
 *
 * @async
 * @function parseCsvToArray
 * @param {string} csvString - The CSV data as a string.
 * @param {Function} processFunction - A function to apply to each row of the CSV data.
 * @returns {Array} An array of objects that passed the filter function.
 * @throws {Error} If an error occurs during the CSV processing.
 */
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

/**
 * Screens for records with; non-terminated postcodes, records only in England
 * and records which are part of a participating ICB
 * Extracts information specified in annotated user guide attached to GAL-288
 *
 * @function processGridallRow
 * @param {Array} dataArray - The array to which filtered records will be added.
 * @param {Object} row - The current row of data being processed.
 * @param {number} participating_counter - A counter tracking the number of records that meet the specified criteria.
 * @returns {number} The updated counter after processing the current row.
 *
 */
export const processGridallRow = (dataArray, row, participating_counter) => {
  if (
    row.DOTERM === "" &&
    row.CTRY === "E92000001" &&
    participatingIcbs.has(row.ICB)
  ) {
    const gridall_element = {
      POSTCODE: row.PCD2,
      POSTCODE_2: row.PCDS,
      LOCAL_AUT_ORG: row.ODSLAUA,
      NHS_ENG_REGION: row.NHSER,
      SUB_ICB: row.SICB,
      CANCER_REGISTRY: row.CANREG,
      EASTING_1M: row.OSEAST1M,
      NORTHING_1M: row.OSNRTH1M,
      LSOA_2011: row.LSOA11,
      MSOA_2011: row.MSOA11,
      CANCER_ALLIANCE: row.CALNCV,
      ICB: row.ICB,
      OA_2021: row.OA21,
      LSOA_2021: row.LSOA21,
      MSOA_2021: row.MSOA21,
    };

    dataArray.push(gridall_element);
    participating_counter++;
  }
  return participating_counter;
};

/**
 * Attempting to extract IMD
 *
 * @function processImdRow
 * @param {Array} dataArray - The array to which filtered records will be added.
 * @param {Object} row - The current row of data being processed.
 * @param {number} participating_counter - A counter tracking the number of records that meet the specified criteria.
 * @returns {number} The updated counter after processing the current row.
 *
 */
export const processImdRow = (dataArray, row, participating_counter) => {
  // Removing comma contained withing value for IMD rank
  const IMD_RANK = row["Index of Multiple Deprivation (IMD) Rank"].replace(
    /,/g,
    ""
  );

  const imd_element = {
    LSOA_CODE: Object.values(row)[0], // has a weird character at the beginning
    LSOA_NAME: row["LSOA name (2011)"],
    IMD_RANK: IMD_RANK,
    IMD_DECILE: row["Index of Multiple Deprivation (IMD) Decile"],
  };

  dataArray.push(imd_element);
  participating_counter++;
};

/**
 * Concatenates header and data into single string - the format S3 looks for.
 *
 * @function generateCsvString
 * @param {string} header - The header row for the CSV.
 * @param {Array} dataArray - The array of objects to convert to CSV.
 * @returns {string} The generated CSV string.
 */
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

/**
 * Attach IMD rank and decile score to gridall record.
 *
 * @function generateCsvString
 * @param {Array} gridallData - The array of gridall records to be processed.
 * @param {Array} imdData - The array of IMD data records to be merged with gridall records.
 * @param {number} startTime - The timestamp indicating the start time.
 * @returns {Array} An array of combined records with attached IMD rank and decile score.
 *
 */
export const mergeImdGridallData = (gridallData, imdData, startTime) => {
  console.log("Attempting to format imd dictionary records");
  let imdDict = {};

  for (let i = 0; i < imdData.length; i++) {
    const elementB = imdData[i];
    imdDict[elementB.LSOA_CODE] = elementB;
  }
  console.log(
    "IMD dictionary created in: ",
    (Date.now() - startTime) / 1000 / 60
  );

  // Iterate through gridallData and match elements
  // from imdData based on 'LSOA_CODE' property
  console.log("Attempting to combine records");
  const startTimeMatching = Date.now();
  let count = 0;
  const lsoaArray = gridallData.map((gridallRecord) => {
    const matchingElement = imdDict[gridallRecord.LSOA_2011];

    if (matchingElement) {
      count++;
      gridallRecord.IMD_RANK = matchingElement.IMD_RANK;
      gridallRecord.IMD_DECILE = matchingElement.IMD_DECILE;
      gridallRecord.LSOA_NAME = matchingElement.LSOA_NAME;
      return gridallRecord;
    }
  });
  console.log(
    "Function to combine records took: ",
    (Date.now() - startTimeMatching) / 1000 / 60
  );
  console.log("Amount of combined records: ", count);
  return lsoaArray;
};

// Lambda Entry Point
export const handler = async () => {
  const bucketName = GALLERI_ONS_BUCKET_NAME;
  const client = new S3Client({});
  let gridallCombinedData = [];
  let imdDataArray = [];

  try {
    const start = Date.now();
    console.log("Attempting to extract GRIDALL", start);
    const gridallKeys = [GRIDALL_CHUNK_1, GRIDALL_CHUNK_2, GRIDALL_CHUNK_3];

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

  try {
    const start = Date.now();
    console.log("Attempting to extract IMD", start);
    const imdKey = "imd/IMD2019_Index_of_Multiple_Deprivation.csv";
    const imdCsvString = await readCsvFromS3(bucketName, imdKey, client);
    imdDataArray = await parseCsvToArray(imdCsvString, processImdRow);

    const filteredImdFileString = generateCsvString(
      "LSOA_CODE,LSOA_NAME,IMD_RANK,IMD_DECILE",
      imdDataArray
    );

    await pushCsvToS3(
      bucketName,
      "filtered_data/filteredImdFile.csv",
      filteredImdFileString,
      client
    );
    console.log("IMD extracted: ", Date.now() - start);
  } catch (error) {
    console.error("Error with IMD extraction, procession or uploading", error);
  }

  // Now combine the records
  try {
    const start = Date.now();
    // Attach IMD rank and decile score to gridall record
    const lsoaArray = mergeImdGridallData(
      gridallCombinedData,
      imdDataArray,
      start
    );
    // Format into a csv string to allow reading into bucket
    const combinedImdGridallFileString = generateCsvString(
      `POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE,LSOA_NAME`,
      lsoaArray
    );
    const dateTime = new Date(Date.now()).toISOString();

    const filename = `lsoa_data_${dateTime}`;

    await pushCsvToS3(
      bucketName,
      `lsoa_data/${filename}.csv`,
      combinedImdGridallFileString,
      client
    );
    console.log("Records pushed to S3 in (ms): ", Date.now() - start);
  } catch (e) {
    console.log("Error with uploading records: ", e);
  }
};
