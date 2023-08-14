import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import csv from 'csv-parser';

const participatingIcbs = new Set([
  'QE1', 'QWO', 'QOQ', 'QF7', 'QHG', 'QM7', 'QH8',
  'QMJ', 'QMF', 'QRV', 'QWE', 'QT6', 'QJK',
  'QOX', 'QUY', 'QVV', 'QR1', 'QSL', 'QRL',
  'QU9', 'QNQ', 'QXU', 'QNX'
]);

export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    }));

    return response.Body.transformToString();
  } catch (err) {
      console.log('Failed: ', err);
      throw err;
    }
};

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
    }));

    console.log('Succeeded');
    return response;
  } catch (err) {
    console.log('Failed: ', err);
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
        participating_counter = processFunction(dataArray, row, participating_counter);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

// Screens for records with; non-terminated postcodes, records only in England
// and records which are part of a participating ICB
// Extracts information specified in annotated user guide attached to GAL-288
export const processGridallRow = (dataArray, row, participating_counter) => {
  if (row.DOTERM === '' && row.CTRY === 'E92000001' && participatingIcbs.has(row.ICB) ){

    const gridall_element = {
      "POSTCODE" : row.PCD2,
      "POSTCODE_2" : row.PCDS,
      "LOCAL_AUT_ORG" : row.ODSLAUA,
      "NHS_ENG_REGION" : row.NHSER,
      "SUB_ICB" : row.SICB,
      "CANCER_REGISTRY" : row.CANREG,
      "EASTING_1M" : row.OSEAST1M,
      "NORTHING_1M" : row.OSNRTH1M,
      "LSOA_2011" : row.LSOA11,
      "MSOA_2011": row.MSOA11,
      "CANCER_ALLIANCE" : row.CALNCV,
      "ICB" : row.ICB,
      "OA_2021" : row.OA21,
      "LSOA_2021" : row.LSOA21,
      "MSOA_2021" : row.MSOA21
    };

    dataArray.push(gridall_element);
    participating_counter++;
  }
  return participating_counter;
};

export const processImdRow = (dataArray, row, participating_counter) => {
  // Removing comma contained withing value for IMD rank
  const IMD_RANK = row['Index of Multiple Deprivation (IMD) Rank'].replace(/,/g, '')

  const imd_element = {
    "LSOA_CODE" : Object.values(row)[0], // has a weird character at the beginning
    "LSOA_NAME" : row['LSOA name (2011)'],
    "IMD_RANK" : IMD_RANK,
    "IMD_DECILE" : row['Index of Multiple Deprivation (IMD) Decile']
  };

  dataArray.push(imd_element);
  participating_counter++;
};

// Concatenates header and data into single string - the format S3 looks for
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map(element => Object.values(element).join(","))
  ].join("\n");
};

// Lambda Entry Point
export const handler = async () => {
  const bucketName = "galleri-ons-data";
  const client = new S3Client({})
  let gridallCombinedData = []
  let imdDataArray = []

  try {
    const start = Date.now();
    console.log('Attempting to extract GRIDALL', start)
    const gridallKeys = [
      "gridall/chunk_data/chunk_1.csv",
      "gridall/chunk_data/chunk_2.csv",
      "gridall/chunk_data/chunk_3.csv"
    ];

    // For each data chunk, read in the CSV stored in AWS S3.
    // Discard rows and columns that are not needed
    // Return an array of objects that contain the filtered data
    const gridallPromises = gridallKeys.map(async (gridallKey) => {
      const gridallCsvString = await readCsvFromS3(bucketName, gridallKey, client);
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
    await pushCsvToS3(bucketName, "filteredGridallFile.csv", filteredGridallFileString,client);
    console.log('GRIDALL extracted: ', Date.now() - start)

  } catch (error) {
    console.error('Error with Gridall extraction, procession or uploading', error);
  }

  try {
    const start = Date.now();
    console.log('Attempting to extract IMD', start)
    const imdKey = "imd/IMD2019_Index_of_Multiple_Deprivation.csv";
    const imdCsvString = await readCsvFromS3(bucketName, imdKey, client);
    imdDataArray = await parseCsvToArray(imdCsvString, processImdRow);

    const filteredImdFileString = generateCsvString(
      "LSOA_CODE,LSOA_NAME,IMD_RANK,IMD_DECILE",
      imdDataArray
      );

    await pushCsvToS3(bucketName, "filteredImdFile.csv", filteredImdFileString, client);
    console.log('IMD extracted: ', Date.now() - start)

  } catch (error) {
    console.error('Error with IMD extraction, procession or uploading',error);
  }

  // Now combine the records
  try {
    const start = Date.now();
    console.log('Attempting to format imd dictionary records')
    let imdDict = {};
    for (let i = 0; i < imdDataArray.length; i++) {
      const elementB = imdDataArray[i];
      imdDict[elementB.LSOA_CODE] = elementB;
    }
    console.log('Length of imd dictionary should be 32844: ' ,Object.keys(imdDict).length)
    console.log('IMD dictionary created in: ', ((Date.now() - start)/1000)/60)

    // Iterate through gridallCombinedData and match elements
    // from imdDataArray based on 'LSOA_CODE' property
    console.log('Attempting to combine records')
    const start1 = Date.now();
    let count = 0
    const lsoaArray = gridallCombinedData.map(gridallRecord => {
      const matchingElement = imdDict[gridallRecord.LSOA_2011];

      if (matchingElement) {
        count++
        gridallRecord.IMD_RANK = matchingElement.IMD_RANK;
        gridallRecord.IMD_DECILE = matchingElement.IMD_DECILE;
        return gridallRecord
      }
    })
    console.log('Function to combine records took: ', ((Date.now() - start1)/1000)/60)
    console.log('Amount of combined records: ' , count)

    const combinedImdGridallFileString = generateCsvString(
      `POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE`,
      lsoaArray
    );
    await pushCsvToS3(bucketName, "combinedImdGridallFileString.csv", combinedImdGridallFileString, client);
    console.log('Records pushed to S3: ', Date.now() - start)

  } catch (e) {
    console.log("Error with uploading records: " ,e)
  }
};
