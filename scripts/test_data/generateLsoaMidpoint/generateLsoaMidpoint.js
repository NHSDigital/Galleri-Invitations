import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

import { groupBy } from "../utils/helper.js";

//Variables
const lsoaData = fs.readFileSync(
  "./input/lsoa_data_2023-08-21T16_26_00.578Z.csv"
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

const lsoaHeader =
  "POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M," +
  "NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021," +
  "IMD_RANK,IMD_DECILE,AVG_EASTING,AVG_NORTHING";

const lsoaArray = await processData(lsoaData);

const lsoaGrouped = groupBy(lsoaArray, "LSOA_2011");

const lsoaAvgGeneratedCsv = generateCsvString(lsoaHeader, lsoaGrouped);

writeFile("./output/lsoa_with_avg_easting_northing.csv", lsoaAvgGeneratedCsv);
