import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

const lsoaData = fs.readFileSync(
  "./input/lsoa_data_2023-08-21T16_26_00.578Z.csv"
);

const lsoaTest = fs.readFileSync("./input/lsoa_test_data.csv");

let row_counter = 0;

//Read in csv
const processData = async (csvString) => {
  const dataArray = [];

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

//need to drill down inside each object which is grouped and obtain EASTING_1M and NORTHING_1M total.
//calculate avg i.e. [easting_1m, easting_1m, ... n]/n

//func to group postcodes by lsoa, prop is the property groupBy order
function groupBy(arr, prop) {
  const map = new Map(Array.from(arr, (obj) => [obj[prop], []]));
  arr.forEach((obj) => {
    map.get(obj[prop]).push(obj);
  });

  map.forEach((x) => {
    let avgEasting = 0;
    let avgNorthing = 0;
    // console.log("x is: ");
    // console.log(x);
    // console.log(x.length);
    for (let i = 0; i < x.length; i++) {
      avgEasting += Math.floor(parseInt(x[i].EASTING_1M, 10) / x.length);
      avgNorthing += Math.floor(parseInt(x[i].NORTHING_1M, 10) / x.length);
    }
    // console.log(`avgEasting: ${avgEasting}, avgNorthing: ${avgNorthing}`);
    for (let i = 0; i < x.length; i++) {
      x[i].AVG_EASTING = String(avgEasting);
      x[i].AVG_NORTHING = avgNorthing.toLocaleString("en-GB", {
        minimumIntegerDigits: 7,
        useGrouping: false,
      });
      // x[i].AVG_NORTHING = String(avgNorthing);
    }
  });
  // const finalArray = Array.from(map.values());
  return Array.from(map.values());
  // console.log(finalArray);
}

//Convert string to csv
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

//Create new file with filename as name, and obj as csv passed in
const writeFile = (filename, obj) => {
  fs.writeFile(filename, obj, (err) => {
    if (err) {
      console.log(err);
    }
    console.log("CSV file saved successfully");
  });
};

const lsoaHeader =
  "POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE";

const lsoaArray = await processData(lsoaTest);

const lsoaGrouped = groupBy(lsoaArray, "LSOA_2011");

console.log(lsoaGrouped);

// console.log(lsoaGrouped[0][0].POSTCODE_2);
// console.log(typeof lsoaGrouped);
