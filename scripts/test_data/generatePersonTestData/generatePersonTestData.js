import {
  readFromCsv,
  writeToCsv,
  getPostcodesFromCsv,
  getRandomRecord,
  updatePostcode,
  logProcessCompletion,
} from "./utility.js";

// Data
var dummyDataMale = [];
var dummyDataFemale = [];
var newDummyDataMale = [];
var newDummyDataFemale = [];

// Counters
var newDummyDataMaleIncludesCount = 0;
var newDummyDataFemaleIncludesCount = 0;

// Reference LSOA data
var lsoaData = [];
var refPostcodes = [];

async function load() {
  console.log("Starting load...\n------------------------");
  dummyDataMale = await readFromCsv(
    "./csv/dummy_data_male.csv",
    "dummy male data"
  );
  dummyDataFemale = await readFromCsv(
    "./csv/dummy_data_female.csv",
    "dummy female data"
  );
  lsoaData = await readFromCsv("./csv/lsoa_data_2023_08_21.csv", "lsoa data");
}

function process() {
  console.log("\nStarting update process...\n------------------------");
  refPostcodes = getPostcodesFromCsv(lsoaData);
  let prevLog = "";
  let log = "";

  console.log("Updating male data...");
  dummyDataMale.forEach((record, index) => {
    log = logProcessCompletion(index, dummyDataMale, "Updating Male data");
    if (log !== prevLog) {
      console.log(log);
      prevLog = log;
    }
    if (refPostcodes.includes(record.postcode)) {
      newDummyDataMale.push(record);
    } else {
      const newRecord = updatePostcode(
        record,
        getRandomRecord(lsoaData).POSTCODE_2
      );
      newDummyDataMale.push(newRecord);
    }
  });
  console.log("---- Updated male data.");

  console.log("Updating female data...");
  dummyDataFemale.forEach((record, index) => {
    log = logProcessCompletion(index, dummyDataFemale, "Updating Female data");
    if (log !== prevLog) {
      console.log(log);
      prevLog = log;
    }
    if (refPostcodes.includes(record.postcode)) {
      newDummyDataFemale.push(record);
    } else {
      const newRecord = updatePostcode(
        record,
        getRandomRecord(lsoaData).POSTCODE_2
      );
      newDummyDataFemale.push(newRecord);
    }
  });
  console.log("---- Updated female data.");

  if (
    dummyDataMale.length === newDummyDataMale.length &&
    dummyDataFemale.length === newDummyDataFemale.length
  ) {
    return true;
  }
  return false;
}

function validate() {
  let prevLog = "";
  let log = "";
  console.log("Validating...");
  console.log("Validating male data...");
  newDummyDataMale.forEach((record, index) => {
    log = logProcessCompletion(index, newDummyDataMale, "Validating Male data");
    if (log !== prevLog) {
      console.log(log);
      prevLog = log;
    }
    if (refPostcodes.includes(record.postcode)) {
      newDummyDataMaleIncludesCount += 1;
    } else {
      return false;
    }
  });
  console.log("Validating female data...");
  newDummyDataFemale.forEach((record, index) => {
    log = logProcessCompletion(
      index,
      newDummyDataFemale,
      "Validating Female data"
    );
    if (log !== prevLog) {
      console.log(log);
      prevLog = log;
    }
    if (refPostcodes.includes(record.postcode)) {
      newDummyDataFemaleIncludesCount += 1;
    } else {
      return false;
    }
  });

  if (
    newDummyDataMaleIncludesCount === dummyDataMale.length &&
    newDummyDataFemaleIncludesCount === dummyDataFemale.length
  ) {
    return true;
  } else {
    return false;
  }
}

async function write() {
  console.log("\nWriting to CSV...\n------------------------");
  if (
    (await writeToCsv(
      newDummyDataMale,
      "dummy data male",
      "./output/csv/dummyDataMaleUpdated.csv"
    )) &&
    (await writeToCsv(
      newDummyDataFemale,
      "dummy data female",
      "./output/csv/dummyDataFemaleUpdated.csv"
    ))
  ) {
    return true;
  } else {
    return false;
  }
}

async function run() {
  try {
    await load();
  } catch {
    console.error("Load failed.");
  }

  if (
    dummyDataMale.length !== 0 &&
    dummyDataFemale.length !== 0 &&
    lsoaData.length !== 0
  ) {
    if (process()) {
      console.log("\nProcess succeeded.");
      if (validate()) {
        console.log("\nValidation succeeded.");
        if (await write()) {
          console.log("\nWriting done.");
        } else {
          console.error("Error: Failed to write files.");
        }
      } else {
        console.error("\nValidation failed.");
      }
    } else {
      console.error("\nProcess failed.");
    }
  }
}
await run();
