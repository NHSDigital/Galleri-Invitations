import {
  validateRecord,
  isValidNHSNumberFormat,
  isValidRemovalReasonCode,
  isValidGender,
  isValidDateFormat,
  isValidDateFormatOrInTheFuture,
} from '../../processCaasFeedLambda/helper/validateCassFeed';

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
    const validationResult = validateRecord({ ...validRecord, superseded_by_nhs_number: '123456' });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - The Superseded by NHS number was not supplied in a valid format"
    );
  });

});
