import {
  validateRecord, handler, readCsvFromS3, pushCsvToS3, parseCsvToArray, filterRecordStatus, convertArrayOfObjectsToCSV
} from '../../validateCaasFeedLambda/validateCaasFeedLambda';
import AWS from 'aws-sdk-mock';
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import * as fs from "fs";
import path from "path";

const validRecord = {
  "nhs_number": "1234567890",
  "superseded_by_nhs_number": "null",
  "primary_care_provider": "B85023",
  "gp_connect": "true",
  "name_prefix": "null",
  "given_name": "Yellow",
  "other_given_names": "Zöe-Garciá_Eleña.|Andrea Brown|Charles 3",
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


describe('validateCaasFeed function', () => {

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

  test('should return failure for blank Primary Care Provider', () => {
    const validationResult = validateRecord({ ...validRecord, primary_care_provider: " " });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - GP Practice code contain blank values"
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
    const validationResult = validateRecord({ ...validRecord, given_name: "" });

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

  test('should return failure for missing other given name', () => {
    const validationResult = validateRecord({ ...validRecord, other_given_names: "" });

    expect(validationResult.success).toBe(false);
    expect(validationResult.message).toBe(
      "Technical error - Other given name is missing"
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("return string built from csv file", async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const stream = sdkStreamMixin(
      fs.createReadStream(path.resolve(__dirname, "./testData/chunk_1.csv"))
    );
    mockS3Client.resolves({
      Body: stream,
    });

    const result = await readCsvFromS3("aaaaaaa", "aaaaaaa", mockS3Client);
    const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n';
    expect(result).toEqual(expected_result);
  });

  test("Failed response when error occurs getting file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    try {
      await readCsvFromS3("aaaaaaa", "aaaaaaa", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Error: Failed to read from aaaaaaa/aaaaaaa");
  });

  test("Successful response from sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await pushCsvToS3(
      "galleri-ons-data",
      "test.txt",
      "dfsdfd",
      mockS3Client
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Succeeded`);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });
  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushCsvToS3("galleri-ons-data", "test.txt", "dfsdfd", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Error: Failed to push to galleri-ons-data/test.txt. Error Message: Error: Mocked error");
  });

  const testCsvString = `"nhs_number","dob","dod"\n"000","10/01/1991","11/01/1991"\n"111","01/09/2000","15/11/2023"`;
  test("should parse CSV string and call processFunction for each row", async () => {

    const result = await parseCsvToArray(testCsvString);
    expect(result).toEqual([
      { nhs_number: "000", dob: "10/01/1991", dod: "11/01/1991" },
      { nhs_number: "111", dob: "01/09/2000", dod: "15/11/2023" },
    ]);
  });

  beforeEach(() => {
    AWS.mock('S3', 'getObject', (params, callback) => {
      // Provide a mocked response for getObject
      callback(null, { Body: 'mocked CSV data' });
    });

    AWS.mock('S3', 'putObject', (params, callback) => {
      // Provide a mocked response for putObject
      callback(null, 'mocked response');
    });
  });

  afterEach(() => {
    AWS.restore('S3');
  });

  test('should filter records into ADD, UPDATE, and DELETE arrays', () => {
    const records = [
      { action: 'ADD', data: 'record1' },
      { action: 'UPDATE', data: 'record2' },
      { action: 'DEL', data: 'record3' },
      { action: 'ADD', data: 'record4' },
    ];

    const [recordsAdd, recordsUpdate, recordsDelete] = filterRecordStatus(records);

    expect(recordsAdd).toEqual([{ action: 'ADD', data: 'record1' }, { action: 'ADD', data: 'record4' }]);
    expect(recordsUpdate).toEqual([{ action: 'UPDATE', data: 'record2' }]);
    expect(recordsDelete).toEqual([{ action: 'DEL', data: 'record3' }]);
  });

  test('should handle empty records array', () => {
    const records = [];

    const [recordsAdd, recordsUpdate, recordsDelete] = filterRecordStatus(records);

    expect(recordsAdd).toEqual([]);
    expect(recordsUpdate).toEqual([]);
    expect(recordsDelete).toEqual([]);
  });

  test('should convert an array of objects to CSV format', () => {
    const data = [
      { "name": 'John"connor"', "age": "30", "city": 'New York' },
      { "name": 'Jane', "age": "25", "city": 'San Francisco' },
    ];

    const csvContent = convertArrayOfObjectsToCSV(data);

    const expectedCSV = 'name,age,city\n"John""connor""",30,New York\nJane,25,San Francisco';
    expect(csvContent).toEqual(expectedCSV);
  });

  test('should handle empty data array', () => {
    const data = [];

    const csvContent = convertArrayOfObjectsToCSV(data);

    expect(csvContent).toEqual('');
  });

  test('should parse CSV to array', async () => {
    const csvString = 'field1,field2\nvalue1,value2\nvalue3,value4';

    const result = await parseCsvToArray(csvString);

    // Add your assertions here
    expect(result).toEqual([
      { field1: 'value1', field2: 'value2' },
      { field1: 'value3', field2: 'value4' },
    ]);
  });
});
