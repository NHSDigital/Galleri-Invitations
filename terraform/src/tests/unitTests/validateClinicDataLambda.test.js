import * as moduleapi from '../../validateClinicDataLambda/validateClinicDataLambda.js';
import AWS from 'aws-sdk-mock';
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import data from "./testData/ClinicData.json";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  describe('validateClinicData postcode function', () => {

    test('Postcode not in Gridall', async ()=>{
      mockDynamoDbClient.resolves({
        Item: [],
      });
      const postcodeValidation = await moduleapi.isPostcodeInGridall("NW1 2HC", mockDynamoDbClient);
      expect(postcodeValidation.Item.length).toBe(0);
    });

    test('Postcode in Gridall', async ()=>{
      mockDynamoDbClient.resolves({
        "Item": {
          "ICB": {
            "S": "QNX"
          }
        }
      });
      const postcodeValidation = await moduleapi.isPostcodeInGridall("NW1 2HC", mockDynamoDbClient);
      expect(postcodeValidation.Item.ICB.S).toBe("QNX");
    });

  })
  describe('validateClinicData function', () => {

    test('should return success for a valid record', async() => {

      mockDynamoDbClient.resolves({
        "Item": {
          "ICB": {
            "S": "QNX"
          }
        }
      });
      const validationResult = await moduleapi.validateRecord(data[0], mockDynamoDbClient);
      expect(validationResult.success).toBe(true);
    });

    test('should return failure for an invalid post code', async() => {

      mockDynamoDbClient.resolves({
        metadata: [],
      });
      const validationResult = await moduleapi.validateRecord(data[0], mockDynamoDbClient);
      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe(
        'Invalid PostCode : SO42 7BZ'
      );
    });

    test('should return failure for an invalid ICB code', async() => {
      mockDynamoDbClient.resolves({
        "Item": {
          "ICB": {S:"01D"}
        }
      });
      const validationResult = await moduleapi.validateRecord(data[1], mockDynamoDbClient);

      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe(
        'Invalid ICB Code : 01D'
      );
    });

    test('should return failure for wrong postcode', async() => {
      const validationResult = await moduleapi.validateRecord(data[2], mockDynamoDbClient);
      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe("Invalid JSON");
    });

    test('should return failure for wrong ODScode', async() => {
        const validationResult = await moduleapi.validateRecord(data[3], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid JSON");
      });

      test('should return failure for missing Clinic Name', async() => {
        const validationResult = await moduleapi.validateRecord(data[4], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid JSON");
      });

      test('should return failure for missing Address', async() => {
        const validationResult = await moduleapi.validateRecord(data[5], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid JSON");
      });

      test('should return failure for missing Directions', async() => {
        const validationResult = await moduleapi.validateRecord(data[6], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid JSON");
      });

      test('should return failure for missing Directions', async() => {
        mockDynamoDbClient.resolves({
          "Item": {
            "ICB": {S:"QNX"}
          }
        });
        const validationResult = await moduleapi.validateRecord(data[7], mockDynamoDbClient);
        expect(validationResult.success).toBe(true);
        expect(validationResult.key.ClinicCreateOrUpdate.ICBCode).toBe("QNX");
      });

      test('should return failure for missing Directions', async() => {
        mockDynamoDbClient.resolves({
          "Item": {
            "ICB": {S:"QJK"}
          }
        });
        const validationResult = await moduleapi.validateRecord(data[8], mockDynamoDbClient);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Invalid ICB Code provided in GTMS message: QNX");
      });

      test('should return failure for missing Directions', async() => {
        mockDynamoDbClient.resolves({
          "Item": {
            "ICB": {S:"QJK"}
          }
        });
        const validationResult = await moduleapi.validateRecord(data[9], mockDynamoDbClient);
        expect(validationResult.success).toBe(true);
        expect(validationResult.key.ClinicCreateOrUpdate.ICBCode).toBe("QJK");
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
        "galleri-clinic-data",
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
        await moduleapi.pushToS3("galleri-clinic-data", "test.txt", "dfsdfd", mockClient);
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
    });

    afterEach(() => {
      AWS.restore('S3');
    });
  });
