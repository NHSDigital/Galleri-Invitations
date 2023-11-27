import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

const lsoaData = fs.readFileSync(
  "./input/copyunique_lsoa_data.csv"
);

const LsoaModerators = fs.readFileSync(
  "./input/copyLSOA_moderators.csv"
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


const lsoaArray = await processData(lsoaData);
const arrWithMod = await processData(LsoaModerators);
// console.log(arrWithMod);


//make moderator to be 3dp e.g. 0.831
const decimalPlace = (lsoa) => {
  const lsoaRecords = [];
  lsoa.forEach((lsoa) => {
    // console.log(lsoa); //{ LSOA_CODE: 'E01024900', ICB: 'QE1', Moderator: '0.712937978' }
    for (const element in lsoa) {
      console.log(element);
      delete lsoa['ICB'];
      if (element === 'Moderator') {
        let roundedElement = Math.round(lsoa[element] * 1000) / 1000;
        lsoa[element] = roundedElement;
      }
      lsoaRecords.push(lsoa);
    }
  });
  console.log('here');
  return lsoaRecords;
};

console.log(decimalPlace(arrWithMod));

//compare lsoacodes of both arrays and append moderator if it matches
const match = (lsoa, data) => {
  const lsoaRecords = {};
  lsoa.forEach((lsoa) => {
    for (const element of data) {
      if (String(element.LSOA_2011) === String(lsoa)) {
        lsoaRecords.push(element);
        break;
      }
    }
  });
  return lsoaRecords;
};

// const matyy = match(lsoaArray, lsoaWithModCodes);
// console.log(matyy);

//in python script, update it to seed in a new column
