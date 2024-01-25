import {
    validateRecord, handler, readFromS3, pushToS3, isValidICBCode, isPostcodeInGridall
  } from '../../validateClinicDataLambda/validateClinicDataLambda.js';
import AWS from 'aws-sdk-mock';
import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import data from "./testData/ClinicData.json";

  describe('validateClinicData function', () => {

    test('should return success for a valid record', () => {
      const validationResult = validateRecord(data[0]);
      expect(validationResult.success).toBe(true);
    });

    test('should return failure for an invalid ICB code', () => {
      const validationResult = validateRecord(data[1]);

      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe(
        'Technical error - Invalid ICB Code'
      );
    });

    test('should return failure for wrong postcode', () => {
      const validationResult = validateRecord(data[2]);
      expect(validationResult.success).toBe(false);
      expect(validationResult.message).toBe("Technical error - Invalid Schema");
    });

    test('should return failure for wrong ODScode', () => {
        const validationResult = validateRecord(data[3]);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Technical error - Invalid Schema");
      });

      test('should return failure for missing Clinic Name', () => {
        const validationResult = validateRecord(data[4]);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Technical error - Invalid Schema");
      });

      test('should return failure for missing Address', () => {
        const validationResult = validateRecord(data[5]);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Technical error - Invalid Schema");
      });

      test('should return failure for missing Directions', () => {
        const validationResult = validateRecord(data[6]);
        expect(validationResult.success).toBe(false);
        expect(validationResult.message).toBe("Technical error - Invalid Schema");
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
        await readFromS3("aaaaaaa", "aaaaaaa", mockClient);
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
      const result = await pushToS3(
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
      const logSpy = jest.spyOn(global.console, "log");
      const errorMsg = new Error("Mocked error");
      const mockClient = {
        send: jest.fn().mockRejectedValue(errorMsg),
      };
      try {
        await pushToS3("galleri-ons-data", "test.txt", "dfsdfd", mockClient);
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
