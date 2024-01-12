import {
  validateRecord,
} from '../../processCaasFeedLambda/helper/validateCaasFeed';

const validRecord = {
  "nhs_number": "1234567890",
  "superseded_by_nhs_number": "null",
  "primary_care_provider": "B85023",
  "gp_connect": "true",
  "name_prefix": "null",
  "given_name": "Yellow",
  "other_given_names": "null",
  "family_name": "Bentley",
  "date_of_birth": "1990-01-01",
  "gender": "2",
  "address_line_1": "11 ABC Road",
  "address_line_2": "Dunsford",
  "address_line_3": "EXETER",
  "address_line_4": "Devon",
  "address_line_5": "null",
  "postcode": "AB1 2CD",
  "reason_for_removal": "null",
  "reason_for_removal_effective_from_date": "null",
  "date_of_death": "null",
  "telephone_number": "null",
  "mobile_number": "null",
  "email_address": "null",
  "preferred_language": "null",
  "is_interpreter_required": "null",
  "action": "ADD"
};

describe('validateRecord function', () => {

  test('should return success for a valid record', () => {

    const validationResult = validateRecord(validRecord);

    expect(validationResult.success).toBe(true);
    expect(validationResult.message).toBe('success');
  });

  test('should return failure for an invalid NHS number format', () => {
    const validationResult = validateRecord({ ...validRecord, nhs_number: 'invalid_nhs_number' });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      'Technical error - NHS number was not supplied in a valid format'
    );
  });

  test('should return failure for missing postcode', () => {
    const validationResult = validateRecord({ ...validRecord, postcode: '' });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      'Technical error - Postcode was not supplied'
    );
  });

  test('should return failure for invalid Superseded by NHS number', () => {
    const validationResult = validateRecord({ ...validRecord, superseded_by_nhs_number: '123456' });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - The Superseded by NHS number was not supplied in a valid format"
    );
  });

  test('should return failure for the Primary Care Provider and the Reason for Removal fields contain values', () => {
    const validationResult = validateRecord({ ...validRecord, primary_care_provider: "null", reason_for_removal: "null", });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - GP Practice code and Reason for Removal fields contain incompatible values"
    );
  });

  test('should return failure for missing given name', () => {
    const validationResult = validateRecord({ ...validRecord, given_name: "null" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Given Name is missing"
    );
  });

  test('should return failure for missing family name', () => {
    const validationResult = validateRecord({ ...validRecord, family_name: "" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Family Name is missing"
    );
  });

  test('should return failure for invalid DOB format or is in the future', () => {
    const validationResult = validateRecord({ ...validRecord, date_of_birth: "2030-11-11" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Date of Birth is invalid or missing"
    );
  });

  test('should return failure for invalid gender provided', () => {
    const validationResult = validateRecord({ ...validRecord, gender: "5" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Missing or invalid Gender"
    );
  });

  test('should return failure for missing postcode', () => {
    const validationResult = validateRecord({ ...validRecord, gender: "5" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Missing or invalid Gender"
    );
  });

  test('should return failure for invalid gender provided', () => {
    const validationResult = validateRecord({ ...validRecord, postcode: "" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Postcode was not supplied"
    );
  });

  test('should return failure for Incorrect Reason for Removal code provided', () => {
    const validationResult = validateRecord({ ...validRecord, primary_care_provider: "null", reason_for_removal: "ABC1" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Invalid reason for removal"
    );
  });

  test('should return failure for invalid DOD format or is in the future', () => {
    const validationResult = validateRecord({ ...validRecord, date_of_death: "2035-12-01" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Date of Death is invalid"
    );
  });

  test('should return failure for invalid Reason for Removal Business Effective From Date', () => {
    const validationResult = validateRecord({ ...validRecord, reason_for_removal_effective_from_date: "2024-13-1" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Reason for Removal Business Effective From Date is invalid"
    );
  });
});
