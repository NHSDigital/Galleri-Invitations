import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import csv from 'csv-parser';
import fs from 'fs'

const client = new S3Client({});

const participatingIcbs = new Set([
  'QE1', 'QWO', 'QOQ', 'QF7', 'QHG', 'QM7', 'QH8',
  'QMJ', 'QMF', 'QRV', 'QWE', 'QT6', 'QJK',
  'QOX', 'QUY', 'QVV', 'QR1', 'QSL', 'QRL',
  'QU9', 'QNQ', 'QXU', 'QNX'
]);


const readCsvFromS3 = async (bucketName, key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const response = await client.send(command);

  // The Body object also has 'transformToByteArray' and 'transformToWebStream' methods.
  // const str = await response.Body.transformToString();

  return response.Body.transformToString();
};

const parseCsvToArray = async (csvString) => {
  let dataArray = [];
  let row_counter = 0
  let participating_postcode_counter = 0
  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        // Only including data with; an active postcode, in England and part of a participating ICB
        row_counter++
        if (row.DOTERM === '' && row.CTRY === 'E92000001' && participatingIcbs.has(row.ICB) ) {
          // remove columns that are not needed
          participating_postcode_counter++

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
          }

          // console.log('Row = '+ JSON.stringify(gridall_element, null, 4) + '\at Row number = ' + row_counter +
          //   '\nCumulative Total = ' + participating_postcode_counter)
          // dataArray.push(gridall_element);
          if (participating_postcode_counter % 1000 == 0) {
            console.log(`Currently at ${participating_postcode_counter}`)
          }
        }
      })
      .on("end", () => {
        console.log("CSV parsing finished, \nRow count = " + row_counter +
          "\nNumber of postcodes highlighted = " + participating_postcode_counter);
          resolve(dataArray)
      })
      .on("error", (err) => {
        reject(err); // Reject the promise with the error if any error occurs during parsing
      });
    })
  // return dataArray;
};

const generateCsvString = (filteredGridallArray) => {
  return [
    [
      "POSTCODE",
      "POSTCODE_2",
      "LOCAL_AUT_ORG",
      "NHS_ENG_REGION",
      "SUB_ICB",
      "CANCER_REGISTRY",
      "EASTING_1M",
      "NORTHING_1M",
      "LSOA_2011",
      "MSOA_2011",
      "CANCER_ALLIANCE",
      "ICB",
      "OA_2021",
      "LSOA_2021",
      "MSOA_2021"
    ],
    ...filteredGridallArray.map(element => [
      item.
      element.POSTCODE,
      element.POSTCODE_2,
      element.LOCAL_AUT_ORG,
      element.NHS_ENG_REGION,
      element.SUB_ICB,
      element.CANCER_REGISTRY,
      element.EASTING_1M,
      element.NORTHING_1M,
      element.LSOA_2011,
      element.MSOA_2011,
      element.CANCER_ALLIANCE,
      element.ICB,
      element.OA_2021,
      element.LSOA_2021,
      element.MSOA_2021
    ])
  ]
  .map(e => e.join(","))
  .join("\n");
}

const writeToFile = (csvString) => {
  try {
    fs.writeFileSync('/tmp/tempFilteredGridallFile.csv', csvString);
    // file written successfully
  } catch (err) {
    console.error(err);
  }
}

const uploadStream = (s3, { Bucket, Key }) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket, Key, Body: pass }).promise(),
  };
}


export const handler = async () => {
  const dataArrayChunk1 = []
  const dataArrayChunk2 = []
  const dataArrayChunk3 = []
  // Chunk 1
  try {
      const bucketName = "galleri-ons-data";
      const key = "gridall/chunk_data/chunk_1.csv";

      console.log("ENTERING CHUNK 1")
      const csvStringChunk1 = await readCsvFromS3(bucketName, key);

      console.log("DONE READING CHUNK 2. NOW PARSING")
      const dataArrayChunk1 = await parseCsvToArray(csvStringChunk1);
      console.log("Array of CSV rows:", dataArrayChunk1.length);
    } catch (error) {
      console.error("Error in Chunk_1:", error);
    }

  // Chunk 2
  try {
      const bucketName = "galleri-ons-data";
      const key = "gridall/chunk_data/chunk_2.csv";

      console.log("ENTERING CHUNK 2")
      const csvStringChunk2 = await readCsvFromS3(bucketName, key);

      console.log("DONE READING CHUNK 2.- NOW PARSING")
      const dataArrayChunk2 = await parseCsvToArray(csvStringChunk2);
      console.log("Array of CSV rows:", dataArrayChunk2.length);
    } catch (error) {
      console.error("Error in Chunk_2:", error);
    }

  // Chunk 3
  try {
    const bucketName = "galleri-ons-data";
    const key = "gridall/chunk_data/chunk_3.csv";

    console.log("ENTERING CHUNK 3")
    const csvStringChunk3 = await readCsvFromS3(bucketName, key);

    console.log("DONE READING CHUNK 3. NOW PARSING")
    const dataArrayChunk3 = await parseCsvToArray(csvStringChunk3);
    console.log("Array of CSV rows:", dataArrayChunk3.length);
  } catch (error) {
    console.error("Error in Chunk_3:", error);
  }

  // concat three arrays
  const combinedData = dataArrayChunk1.concat(dataArrayChunk2, dataArrayChunk3)
  console.log(`Total number of participating postcodes ${combinedData.length}`)

  // Upload the file to S3
  try {
    const filteredGridallFileString = generateCsvString(combinedData)
    try {
      writeToFile(filteredGridallFileString)
    } catch (error) {
      console.error('failed trying to write csv to file', error)
    }

    const { writeStream, promise } =
      uploadStream({Bucket: 'galleri-ons-data', Key: 'gridall/tempFilteredGridallFile.csv'});
    const readStream = fs.createReadStream('/tmp/tempFilteredGridallFile.csv');

    const pipeline = readStream.pipe(writeStream);

    promise.then(() => {
      console.log('upload completed successfully');
    }).catch((err) => {
      console.log('upload failed.', err.message);
    });
  } catch (error) {
    console.error('failed trying to upload filtered Gridall file to s3', error)
  }

  }

