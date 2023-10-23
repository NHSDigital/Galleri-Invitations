import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

//Variables
const lsoaCsv = fs.readFileSync("./lsoa_data.csv");

const processData = async (csvString, processFunction = () => {}) => {
  const dataArray = [];
  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        const attribute = processFunction(row);
        dataArray.push(attribute);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

const processLsoaFunction = (row) => {
  return {
    LSOA: row.LSOA_2011,
    ICB: row.ICB,
  };
};

const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

const writeFile = (fileName, obj) => {
  fs.writeFile(fileName, obj, (err) => {
    if (err) {
      console.log(err);
    }
    console.log("CSV file saved successfully");
  });
};

const lsoaPostcodeDataArr = await processData(lsoaCsv, processLsoaFunction);

// const filteredArray = lsoaPostcodeDataArr.filter((value, index, self) => {
//   console.log(index);
//   index ===
//     self.findIndex((t) => {
//       t.LSOA_2011 === value.LSOA_2011 && t.ICB === value.ICB;
//     });
// });

const headers = "LSOA_CODE, ICB";
const lsoaIcbCsv = generateCsvString(headers, lsoaPostcodeDataArr);

writeFile("lsoa_icb.csv", lsoaIcbCsv);
