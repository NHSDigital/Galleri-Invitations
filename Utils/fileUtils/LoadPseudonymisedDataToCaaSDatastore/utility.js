import csv from 'csv-parser';
import { stringify } from 'csv-stringify';
import fs from 'fs';

// Read from CSV
export async function readFromCsv(filepath, label) {
  let array = [];
  return await new Promise((resolve, reject) => {
    console.log(`Loading -> ${label}`)
    fs.createReadStream(filepath)
      .pipe(csv())
      .on('data', (data) => {
        array.push(data)
      })
      .on('end', () => {
        console.log(`   |--- ${label} done.`);
        resolve(array)
      })
      .on('error', (err) => {
        reject(err)
      });
  })
}

function createColumns(string) {
  const columnsArray = string.split(',');
  let columnObject = {};
  columnsArray.map(header => {
    columnObject[header] = header;
  })
  return columnObject;
}

// Write to CSV
export async function writeToCsv(data, label, filepath) {
  console.log(`Writing -> ${label} written to -> [${filepath}]`)
  let columns = createColumns("nhs_number,superseded_by_subject_id,primary_care_provider,name_prefix,first_given_name,other_given_names,family_name,date_of_birth,gender_code,address_line_1,address_line_2,address_line_3,address_line_4,address_line_5,postcode,removal_reason,removal_date,date_of_death,telephone_number_home,telephone_number_mobile,email_address_home,preferred_language,interpreter_required,sensitivity_indicator_flag");
  stringify(data, { header: true, columns: columns }, (err, output) => {
    if (err) throw err;
    fs.writeFile(filepath, output, (error) => {
      if (error) {
        return false;
      } else {
        return true;
      }
    });
  });
  console.log(`   |--- ${label} done.`);
  return true;
}

// Get an array of postcodes from a CSV array
export function getPostcodesFromCsv(array) {
  return array.map(e => {
    return e.POSTCODE_2;
  })
}

// Get random record
export function getRandomRecord(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Update a records postcode
export function updatePostcode(record, newPostcode) {
  record.postcode = newPostcode;
  return record;
}

// Log the process completion percentage
export function logProcessCompletion(processCounter, processArray, label) {
  const twentyFive = processArray.length * 0.25
  const fifty = processArray.length * 0.5
  const seventyFive = processArray.length * 0.75
  const oneHundred = processArray.length;
  var counter = processCounter + 1;
  var log = ''

  if (counter >= twentyFive && counter < fifty) {
    log = `${label}: 25% done...`;
  }
  else if (counter >= fifty && counter < seventyFive) {
    log = `${label}: 50% done...`;
  }
  else if (counter >= seventyFive && counter < oneHundred) {
    log = `${label}: 75% done...`;
  }
  else if ((counter) === oneHundred) {
    log = `${label}: 100% done...`;
  }
  return log;
}
