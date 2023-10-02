import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";

//Variables
const femaleCsv = fs.readFileSync("./input/test_data_female.csv");
const maleCsv = fs.readFileSync("./input/test_data_male.csv");
const csvLsoa = fs.readFileSync("./input/lsoa_data.csv");
const yearCalc = 3.15576e10; //(365.25 * 24 * 60 * 60 * 1000ms)
let rowCounter = 0;
let count = 0;
let ageRange = {
  "50-54": 0,
  "55-59": 0,
  "60-64": 0,
  "65-69": 0,
  "70-74": 0,
  "75-77": 0,
};
let ageCount = 0;

// Functions
// Read in csv
const processData = async (csvString, processFunction = () => {}) => {
  const dataArray = [];
  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        rowCounter++;
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
// E.g. NW4 1AA
const processLsoaFunction = (row) => {
  return row.POSTCODE_2;
};

// Shortcircuit, return row on each data entry
const processTestDataFunction = (row) => {
  return row;
};

// Convert string to csv
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

// Convert date of birth (yyyy-mm-dd) to age
const obtainAge = (birthDate) => {
  return Math.floor((new Date() - new Date(birthDate).getTime()) / yearCalc);
};

// Convert age back to date of birth (yyyy-mm-dd)
const convertAgeToDateOfBirth = (age) => {
  let ageMs = age * yearCalc; //age in ms
  let dateOfBirth = new Date(new Date().getTime() - ageMs);
  return dateOfBirth.toISOString().slice(0, 10);
};

// Check age to fit into range, change postcode to valid lsoa postcode
const changePostcode = (rowData, ageRangeObj) => {
  rowData.forEach((element) => {
    // If age is outside 50-77, randomly assign dob between ageRange 50-77
    if (
      obtainAge(element.date_of_birth) < 50 ||
      obtainAge(element.date_of_birth) > 80
    ) {
      ageCount++;
      if (ageCount === 1) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (54 - 50) + 50))
        );
        ageRangeObj["50-54"] += 1;
      } else if (ageCount === 2) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (59 - 55) + 55))
        );
        ageRangeObj["55-59"] += 1;
      } else if (ageCount === 3) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (64 - 60) + 60))
        );
        ageRangeObj["60-64"] += 1;
      } else if (ageCount === 4) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (69 - 64) + 64))
        );
        ageRangeObj["65-69"] += 1;
      } else if (ageCount === 5) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (74 - 70) + 70))
        );
        ageRangeObj["70-74"] += 1;
      } else if (ageCount === 6) {
        element.date_of_birth = convertAgeToDateOfBirth(
          (element.date_of_birth = Math.floor(Math.random() * (77 - 75) + 75))
        );
        ageRangeObj["75-77"] += 1;
        ageCount = 0;
      }
    } else {
      // Now check spread of age
      if (obtainAge(element.date_of_birth) < 50) {
        outlier++;
      } else if (obtainAge(element.date_of_birth) < 55) {
        ageRangeObj["50-54"] += 1;
      } else if (obtainAge(element.date_of_birth) < 60) {
        ageRangeObj["55-59"] += 1;
      } else if (obtainAge(element.date_of_birth) < 65) {
        ageRangeObj["60-64"] += 1;
      } else if (obtainAge(element.date_of_birth) < 70) {
        ageRangeObj["65-69"] += 1;
      } else if (obtainAge(element.date_of_birth) < 75) {
        ageRangeObj["70-74"] += 1;
      } else if (obtainAge(element.date_of_birth) < 78) {
        ageRangeObj["75-77"] += 1;
      }
    }

    // Assign postcode outside ICB to postcode inside ICB
    if (!lsoaPostcodeDataArr.includes(element?.postcode)) {
      element.postcode =
        lsoaPostcodeDataArr[
          Math.floor(Math.random() * lsoaPostcodeDataArr.length)
        ];
      console.log(`Found ${count++} non-matching postcodes`);
    }
  });
  return ageRangeObj;
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
const lsoaPostcodeDataArr = await processData(csvLsoa, processLsoaFunction);
const femaleDataArr = await processData(femaleCsv, processTestDataFunction);
const maleDataArr = await processData(maleCsv, processTestDataFunction);

// Process Arrays
changePostcode(femaleDataArr, ageRange);
changePostcode(maleDataArr, ageRange);

const testDataHeader =
  "nhs_number,superseded_by_subject_id,primary_care_provider,name_prefix,first_given_name,other_given_names,family_name,date_of_birth,gender_code,address_line_1,address_line_2,address_line_3,address_line_4,address_line_5,postcode,removal_reason,removal_date,date_of_death,telephone_number_home,telephone_number_mobile,email_address_home,preferred_language,interpreter_required,sensitivity_indicator_flag";
const femaleGeneratedCsv = generateCsvString(testDataHeader, femaleDataArr);
const maleGeneratedCsv = generateCsvString(testDataHeader, maleDataArr);

writeFile("test_data_female_result.csv", femaleGeneratedCsv);
writeFile("test_data_male_result.csv", maleGeneratedCsv);
