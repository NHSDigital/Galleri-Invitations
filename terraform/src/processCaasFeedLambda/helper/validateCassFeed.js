import records from "./caasFeedArray.json" assert { type: "json" };

function validateRecords(records) {
  const outputSuccess = [];
  const outputUnsuccess = [];

  records.forEach((record) => {
    // const id = record['nhs_number']; // NHS no as the key for ID.
    const validationResult = validateRecord(record);

    if (validationResult.success) {
      outputSuccess.push({
        // [id]: {
        message: 'Validation successful',
        ...record,
        // },
      });
    } else {
      // const uniqueHash = `NaN-NHS-${id}`; // Create a unique hash for unsuccessful records
      outputUnsuccess.push({
        // [uniqueHash]: {
        message: validationResult.message,
        ...record,
        // },
      });
    }
  });

  return [outputSuccess, outputUnsuccess];
}

// Validation function skeleton
function validateRecord(record) {
  // Example: Validate if the 'nhs_number' field is not empty.
  if (!record.nhs_number) {
    return { success: false, failedField: 'nhs_number' };
  }

  // Add more validation checks as needed for other fields.

  return { success: true, failedField: null };
}

const [outputSuccess, outputUnsuccess] = validateRecords(records);

console.log('Successful Records:', outputSuccess);
console.log('Unsuccessful Records:', outputUnsuccess);

// Passable Argument below
// const records = [
//   {
//     "nhs_number": "5558028009",
//     "superseded_by_nhs_number": "null",
//     "primary_care_provider": "B83006",
//     "gp_connect": "true",
//     "name_prefix": "Mr",
//     "given_name": "prefix-98164678",
//     "other_given_names": "null",
//     "family_name": "prefix-98164678",
//     "date_of_birth": "1971-12-21",
//     "gender": "1",
//     "address_line_1": "HEXAGON HOUSE",
//     "address_line_2": "PYNES HILL",
//     "address_line_3": "RYDON LANE",
//     "address_line_4": "EXETER",
//     "address_line_5": "DEVON",
//     "postcode": "BV3 9ZA",
//     "reason_for_removal": "null",
//     "reason_for_removal_effective_from_date": "null",
//     "date_of_death": "null",
//     "telephone_number": "null",
//     "mobile_number": "null",
//     "email_address": "null",
//     "preferred_language": "null",
//     "is_interpreter_required": "null",
//     "action": "UPDATE"
//   },
//   {
//     "nhs_number": "5558045337",
//     "superseded_by_nhs_number": "null",
//     "primary_care_provider": "D81026",
//       "gp_connect": "true",
//       "name_prefix": "Mrs",
//       "given_name": "Mummy",
//       "other_given_names": "null",
//       "family_name": "Testing",
//       "date_of_birth": "1968-08-01",
//       "gender": "2",
//       "address_line_1": "1 New Road",
//       "address_line_2": "SOLIHULL",
//       "address_line_3": "West Midlands",
//       "address_line_4": "null",
//       "address_line_5": "null",
//       "postcode": "B91 3DL",
//       "reason_for_removal": "null",
//       "reason_for_removal_effective_from_date": "null",
//       "date_of_death": "1968-08-01",
//       "telephone_number": "null",
//       "mobile_number": "null",
//       "email_address": "null",
//       "preferred_language": "null",
//       "is_interpreter_required": "null",
//       "action": "UPDATE"
//     },
//     {
//       "nhs_number": "5558015160",
//       "superseded_by_nhs_number": "null",
//       "primary_care_provider": "L83137",
//       "gp_connect": "true",
//       "name_prefix": "Dr",
//       "given_name": "john",
//       "other_given_names": "null",
//       "family_name": "jones",
//       "date_of_birth": "1950-12-01",
//       "gender": "1",
//       "address_line_1": "100",
//       "address_line_2": "spen lane",
//       "address_line_3": "Leeds",
//       "address_line_4": "null",
//       "address_line_5": "null",
//       "postcode": "LS16 5BR",
//       "reason_for_removal": "null",
//       "reason_for_removal_effective_from_date": "null",
//       "date_of_death": "null",
//       "telephone_number": "null",
//       "mobile_number": "null",
//       "email_address": "null",
//       "preferred_language": "null",
//       "is_interpreter_required": "null",
//       "action": "UPDATE"
//     },
//   ];
