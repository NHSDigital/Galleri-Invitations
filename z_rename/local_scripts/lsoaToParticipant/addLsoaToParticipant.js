import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";
// import axios from "axios";

//Variables
const femaleCsv = fs.readFileSync("./dummyDataFemaleUpdated.csv");
const maleCsv = fs.readFileSync("./dummyDataMaleUpdated.csv");
const lsoaCsv = fs.readFileSync("./lsoa_data_full.csv")


// Functions
// Read in csv
const processData = async (csvString) => {
  let dataArray = [];
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

const processLsoaData = async (csvString) => {
  let dataObj = {};
  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        // console.log(row)
        dataObj[row.POSTCODE.replace(/\s/g, '')] = row.LSOA_2011
      })
      .on("end", () => {
        resolve(dataObj);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

const attachLsoa = (participantArr, postcodeLsoas) => {
  const participantsWithPostcodeInvited = participantArr.map( (participant, index) => {
    const participantPostcode = participant.postcode?.replace(/\s/g, '')
    const participantPostcodeLsoaMatch = postcodeLsoas[participantPostcode]

    if (participantPostcodeLsoaMatch != undefined){
      console.log(`Match at index ${index}`)
      participant.Invited = Boolean(Math.floor(Math.random() * 2));
      participant.LSOA_2011 = participantPostcodeLsoaMatch
    }
    return participant;
  })
  return participantsWithPostcodeInvited;
}

// Convert string to csv
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

// Create new file with filename as name, and obj as csv passed in
const writeFile = (fileName, obj) => {
  console.log("Writing data to csv")
  fs.writeFile(fileName, obj, (err) => {
    if (err) {
      console.log(err);
    }
    console.log("CSV file saved successfully");
  });
};

//End of Functions


// Read in LSOA file and store in array
const lsoaObject = await processLsoaData(lsoaCsv);

// Generate male participant data
const maleParticipantsDataArr = await processData(maleCsv);
const maleParticipantsWithPostcodeInvited = attachLsoa(maleParticipantsDataArr, lsoaObject)

// Generate female participant data
const femaleParticipantsDataArr = await processData(femaleCsv);
const femaleParticipantsWithPostcodeInvited = attachLsoa(femaleParticipantsDataArr, lsoaObject)

// Header
const testDataHeader =
  "nhs_number,superseded_by_subject_id,primary_care_provider,name_prefix,first_given_name,other_given_names,family_name,date_of_birth,gender_code,address_line_1,address_line_2,address_line_3,address_line_4,address_line_5,postcode,removal_reason,removal_date,date_of_death,telephone_number_home,telephone_number_mobile,email_address_home,preferred_language,interpreter_required,sensitivity_indicator_flag,Invited,LSOA_2011";

// Generate csv string
const maleParticipantsCsv = generateCsvString(testDataHeader, maleParticipantsWithPostcodeInvited);
const femaleParticipantsCsv = generateCsvString(testDataHeader, femaleParticipantsWithPostcodeInvited);

// Write csvs
writeFile("male_participants_with_LSOA_Invited.csv", maleParticipantsCsv);
writeFile("female_participants_with_LSOA_Invited.csv", femaleParticipantsCsv);
