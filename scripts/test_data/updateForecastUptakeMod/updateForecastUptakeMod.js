import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";
import { fixDecimal, match } from "./utils/helper.js";

const lsoaData = fs.readFileSync(
  "./input/unique_lsoa_data.csv"
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

// read in both csvs
const lsoaUniqueArray = await processData(lsoaData);
const arrWithMod = await processData(LsoaModerators);

//cut moderator to 3dp
const newModArr = fixDecimal(arrWithMod);

//match and append moderator to unique lsoa
const matched = match(lsoaUniqueArray, newModArr);

const uniqueDataHeader =
  "LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,LSOA_2011," +
  "MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK," +
  "IMD_DECILE,AVG_EASTING,AVG_NORTHING,MODERATOR";

const uniqueLsoaCsv = generateCsvString(uniqueDataHeader, matched);

writeFile("./output/unique_lsoa_data.csv", uniqueLsoaCsv);
