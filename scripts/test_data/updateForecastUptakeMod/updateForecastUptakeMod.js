import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

const lsoaData = fs.readFileSync(
  "./input/unique_lsoa_data.csv" //remove copy
);

const LsoaModerators = fs.readFileSync(
  "./input/LSOA_moderators.csv"
);

//Read in csv
export const processData = async (csvString) => {
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

//Convert string to csv
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

//Create new file with filename as name, and obj as csv passed in
export const writeFile = (filename, obj) => {
  fs.writeFile(filename, obj, (err) => {
    if (err) {
      console.log(err);
    }
    console.log("CSV file saved successfully");
  });
};

console.time();
const lsoaUniqueArray = await processData(lsoaData);
const arrWithMod = await processData(LsoaModerators);
// console.log(arrWithMod);


//make moderator to be 3dp e.g. 0.831
const decimalPlace = (lsoa) => {
  const lsoaRecords = [];
  lsoa.forEach((lsoa) => {
    // console.log(lsoa); //{ LSOA_CODE: 'E01024900', ICB: 'QE1', Moderator: '0.712937978' }
    for (const element in lsoa) {
      delete lsoa['ICB'];
      if (element === 'MODERATOR') {
        let roundedElement = Math.round(lsoa[element] * 1000) / 1000;
        lsoa[element] = roundedElement;
      }
      lsoaRecords.push(lsoa);
    }
  });
  return lsoaRecords;
};

const newModArr = decimalPlace(arrWithMod);
// console.log(decimalPlace(arrWithMod));

//compare lsoacodes of both arrays and append moderator if it matches
const match = (lsoa, data) => {
  const lsoaRecords = [];
  // console.log('lsoa:');
  // console.log(lsoa);
  // lsoa:
  // [
  //   {
  //     LOCAL_AUT_ORG: '714',
  //     NHS_ENG_REGION: 'Y56',
  //     SUB_ICB: '',
  //     CANCER_REGISTRY: 'Y0801',
  //     LSOA_2011: 'E01000001',
  //     MSOA_2011: 'E02000001',
  //     CANCER_ALLIANCE: 'E56000028',
  //     ICB: 'QMF',
  //     OA_2021: 'E00166756',
  //     LSOA_2021: 'E01000001',
  //     MSOA_2021: 'E02000001',
  //     IMD_RANK: '29199',
  //     IMD_DECILE: '9',
  //     AVG_EASTING: '532130',
  //     AVG_NORTHING: '0181602'
  //   }
  // ]
  // console.log('data:');
  // console.log(data);
  //   data:
  // [
  //   { LSOA_CODE: 'E01012641', Moderator: 0.539 }
  // ]
  lsoa.forEach((lsoa) => {
    // console.log('lsoa data:');
    // console.log(lsoa.LSOA_2011);
    for (const element of data) {
      if (String(element.LSOA_CODE) === String(lsoa.LSOA_2011)) {
        // console.log(element); //{ LSOA_CODE: 'E01024906', Moderator: 0.782 }
        // console.log('match');
        lsoa.MODERATOR = element.MODERATOR.toLocaleString("en-GB", {
          minimumSignificantDigits: 3,
          useGrouping: false,
        });
        break;
      } else {
        lsoa.MODERATOR = 'Not Found'; //need to test with all data
      }
    }
    lsoaRecords.push(lsoa);
  });
  return lsoaRecords;
};

const matched = match(lsoaUniqueArray, newModArr);
console.log(matched);

const uniqueDataHeader =
  "LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE,AVG_EASTING,AVG_NORTHING,MODERATOR";

const uniqueLsoaCsv = generateCsvString(uniqueDataHeader, matched);

writeFile("./output/unique_lsoa_with_moderator.csv", uniqueLsoaCsv);
console.timeEnd(); //taking approx 5s
//in python script, update it to seed in a new column
