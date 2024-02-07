import * as moduleapi from "../../validateClinicCapacityLambda/validateClinicCapacityLambda.js";
import AWS from 'aws-sdk-mock';
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import data from "./testData/ClinicCapacity.json";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  describe('validate ClinicID function', () => {

    test('ClinicID not in DynamoDB', async ()=>{
      mockDynamoDbClient.resolves({
        metadata: [],
      });
      const clinicValidation = await moduleapi.isClinicIDvalid("NJ22I636", mockDynamoDbClient);
      expect(clinicValidation.hasOwnProperty("Items")).toBe(false);
    });

    test('ClinicID not in DynamoDB', async ()=>{
      mockDynamoDbClient.resolves({
        Items: ["NJ22I636"],
      });
      const clinicValidation = await moduleapi.isClinicIDvalid("NJ22I636", mockDynamoDbClient );
      expect(clinicValidation.hasOwnProperty("Items")).toBe(true);
    });

  })
  describe('validateClinicCapacity function', () => {

    test('should return success for a valid record', async() => {

      mockDynamoDbClient.resolves({
        Items: ["NJ22I636"],
      });
      const validationResult = await moduleapi.validateRecord(data[0], mockDynamoDbClient);
      expect(validationResult.success).toBe(true);
    });

    test('should return failure for an invalid ClinicID', async() => {

      mockDynamoDbClient.resolves({
        metadata: [],
      });
      const validationResult = await moduleapi.validateRecord(data[0], mockDynamoDbClient);
      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe('Invalid ClinicID: C1C-A1A');
    });

    test('should return failure for an invalid date', async() => {
      mockDynamoDbClient.resolves({
        Items: ["SO42 7BZ"],
      });
      const validationResult = await moduleapi.validateRecord(data[1], mockDynamoDbClient);

      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe(
        'Invalid JSON Schema'
      );
    });

    test('should return failure for out-of-bound availability', async() => {
      const validationResult = await moduleapi.validateRecord(data[2], mockDynamoDbClient);
      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe("Invalid JSON Schema");
    });

    test('should return failure for wrong clinic ID in multiple clinics', async() => {
        const validationResult = await moduleapi.validateRecord(data[3], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid JSON Schema");
      });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test("Failed response when error occurs getting file to bucket", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const errorMsg = new Error("Mocked error");
      const mockClient = {
        send: jest.fn().mockRejectedValue(errorMsg),
      };

      try {
        await moduleapi.readFromS3("aaaaaaa", "aaaaaaa", mockClient);
      } catch (err) {
        expect(err.message).toBe("Mocked error");
      }
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Failed: ", errorMsg);
    });

    test("Successful response from sending file to bucket", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const mockS3Client = mockClient(new S3Client({}));
      mockS3Client.resolves({
        $metadata: { httpStatusCode: 200 },
      });
      const result = await moduleapi.pushToS3(
        "galleri-clinic-capacity",
        "test.txt",
        "dfsdfd",
        mockS3Client
      );

      expect(logSpy).toHaveBeenCalledTimes(0);
      expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
    });

    test("Failed response when error occurs sending file to bucket", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const errorMsg = new Error("Mocked error");
      const mockClient = {
        send: jest.fn().mockRejectedValue(errorMsg),
      };
      try {
        await moduleapi.pushToS3("galleri-clinic-capacity", "test.txt", "dfsdfd", mockClient);
      } catch (err) {
        expect(err.message).toBe("Mocked error");
      }
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Failed: ", errorMsg);
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
      mockDynamoDbClient.resolves({
        Items: ["SO42 7BZ"],
      });
    });

    afterEach(() => {
      AWS.restore('S3');
    });
  });
