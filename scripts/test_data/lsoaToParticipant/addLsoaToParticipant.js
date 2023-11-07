import { Readable } from "stream";
import csv from "csv-parser";
import fs from "fs";
import axios from "axios";

//Variables
// const maleCsv = fs.readFileSync("./male.csv");
const maleCsv = fs.readFileSync("./dummy_data_male.csv");
const femaleCsv = fs.readFileSync("./dummy_data_male.csv");
const lsoaCsv = fs.readFileSync("./lsoa.csv")


// Functions
// Read in csv
const processData = async (csvString, processFunction) => {
  const dataArray = [];
  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(processFunction(row));
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

function processLsoa(row){
  return {
    lsoa: row.LSOA_2011,
    postcode: row.POSTCODE
  }
}

function processShortCircuit(row){
  return row
}

async function processParticipantPostcode(row) {
  // set random invited field
  row.Invited = Boolean(Math.floor(Math.random() * 2));
  // make axios call
  // attach LSOA code as LSOA_2011
  // return rown

  const postcodeData = await axios.get(
    `https://api.postcodes.io/postcodes/${row.postcode}`
    );
  const requestStatus = postcodeData?.data?.status;

  if (requestStatus == 200) {
    row.LSOA_2011 = postcodeData?.data?.result?.codes?.lsoa;
  } else {
    console.log("response status = ", requestStatus)
  }

  return row
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
const lsoaArray = await processData(lsoaCsv, processLsoa);
const maleParticipantsDataArr = await processData(maleCsv, processShortCircuit);

// if (index % 1000 == 0) console.log(`At row number ${index}`)
// console.log(`participantPostcode = ${participant.postcode.replace(/\s/g, '')} and lsoaPostcode = ${lsoa.postcode.replace(/\s/g, '')}`)
// console.log(`participantPostcode = ${typeof participant.postcode} and lsoaPostcode = ${typeof lsoa.postcode}`)

// Read in test data to Arrays
const maleParticipantsWithPostcodeInvited = maleParticipantsDataArr.map( (participant, index) => {
  const participantPostcodeMatch = lsoaArray.find((lsoa) => {
    return lsoa.postcode.replace(/\s/g, '') === participant.postcode.replace(/\s/g, '')
  })

  if (participantPostcodeMatch != undefined){
    console.log(`Match at index ${index}`)
    participant.Invited = Boolean(Math.floor(Math.random() * 2));
    participant.LSOA_2011 = participantPostcodeMatch.lsoa
  }
  return participant;
})

const testDataHeader =
  "nhs_number,superseded_by_subject_id,primary_care_provider,name_prefix,first_given_name,other_given_names,family_name,date_of_birth,gender_code,address_line_1,address_line_2,address_line_3,address_line_4,address_line_5,postcode,removal_reason,removal_date,date_of_death,telephone_number_home,telephone_number_mobile,email_address_home,preferred_language,interpreter_required,sensitivity_indicator_flag,Invited,LSOA_2011";

// console.log(maleParticipantsWithPostcodeInvited)
const maleParticipantsCsv = generateCsvString(testDataHeader, maleParticipantsWithPostcodeInvited);
writeFile("male_participants_with_LSOA_Invited.csv", maleParticipantsCsv);

// const femaleParticipantsDataArr = await processData(femaleCsv);
// const femaleParticipantsWithPostcodeInvited = await Promise.all(femaleParticipantsDataArr.map( async (participant, index) => {
//   if (index % 1000 == 0) console.log(`At row number ${index}`)
//   const record = await processParticipantPostcode(participant)
//   return record;
// }))

// const femaleParticipantsCsv = generateCsvString(testDataHeader, femaleParticipantsWithPostcodeInvited);
// writeFile("male_participants_with_LSOA_Invited.csv", femaleParticipantsCsv);
