import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

//Variables
const csvLsoa = fs.readFileSync("./lsoa_data_full.csv");

// Functions
// Read in csv
const processData = async (csvString) => {
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

const returnUniqueLsoaCodes = (data) => {
  const uniqueLsoa = [];
  data.forEach((element) => {
    if (!uniqueLsoa.includes(element.LSOA_2011)) {
      uniqueLsoa.push(element.LSOA_2011);
      if (uniqueLsoa.length % 1000 === 0) {
        console.log(uniqueLsoa.length);
      }
    }
  });
  console.log("total unique lsoas = ", uniqueLsoa.length);
  return uniqueLsoa;
};

const returnUniqueLsoaRecords = (lsoaCodeArray, data) => {
  lsoaCodeArray.sort();

  let countLsoa = 0;
  let countRecord = 0;

  const lsoaRecords = [];
  // const lsoaCodeArraySubSet = lsoaCodeArray.slice(0, 2);
  // const dataSubSet = data.slice(0, 16);
  lsoaCodeArray.forEach((lsoa) => {
    console.log(`checking for lsoa ${lsoa}`);
    for (const element of data) {
      if (String(element.LSOA_2011) === String(lsoa)) {
        console.log(`element lsoa = ${element.LSOA_2011} and lsoa = ${lsoa}`);
        lsoaRecords.push(element);
        break;
      }
    }
  });
  console.log("total complete records", lsoaRecords.length);
  return lsoaRecords;
};

// Convert string to csv
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

// Create new file with filename as name, and obj as csv passed in
const writeFile = (fileName, obj) => {
  fs.writeFile(fileName, obj, (err) => {
    if (err) {
      console.log(err);
    }
    console.log("CSV file saved successfully");
  });
};
//End of Functions

// Read in test data to Arrays
const lsoaPostcodeDataArr = await processData(csvLsoa);
// console.log("first csv row = ", lsoaPostcodeDataArr[0]);

// Process Arrays
const lsoaCodes = returnUniqueLsoaCodes(lsoaPostcodeDataArr);
console.log(`lsoaCodes = ${lsoaCodes[1]}`);
const lsoaRecords = returnUniqueLsoaRecords(lsoaCodes, lsoaPostcodeDataArr);
console.log(`lsoaRecords = ${lsoaRecords[1]}`);

const testDataHeader =
  "POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE";
const uniqueLsoaCsv = generateCsvString(testDataHeader, lsoaRecords);

writeFile("lsoa_data_unique.csv", uniqueLsoaCsv);
