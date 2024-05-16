import { mockClient } from "aws-sdk-client-mock";
import {
  getJSONFromS3,
  retrieveAndParseJSON,
  putTRRInS3Bucket,
  deleteTRRinS3Bucket,
} from "../../testCrossCheckReportAppointmentValidationLambda/testCrossCheckReportAppointmentValidationLambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
jest.mock("axios");
import axios from "axios";

describe("deleteTRRinS3Bucket", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("should successfully put cross check TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });

    const result = await deleteTRRinS3Bucket(
      "report1",
      "bucket1",
      mockS3Client
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Successfully deleted report1 from bucket1"
    );
  });

  test("should fail to put cross check TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    let errorCaught = false;

    try {
      await deleteTRRinS3Bucket("report1", "bucket1", mockS3Client);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "Error: deleting report1 from bucket1: Error: Mocked error"
      );
      errorCaught = true;
    }

    expect(errorCaught).toBeTruthy();
  });
});

describe("putTRRinS3Bucket", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("should successfully put cross check TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const mockTRR = {
      key: "value",
    };

    const result = await putTRRInS3Bucket(
      mockTRR,
      "report1",
      "bucket1",
      mockS3Client
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Successfully pushed to bucket1/report1"
    );
  });

  test("should fail to put cross check TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    const mockTRR = {
      key: "value",
    };
    let errorCaught = false;

    try {
      await putTRRInS3Bucket(mockTRR, "report1", "bucket1", mockS3Client);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "Error: Failed to push to bucket1/report1. Error Message: Error: Mocked error"
      );
      errorCaught = true;
    }

    expect(errorCaught).toBeTruthy();
  });
});

describe("retrieveAndParseJSON", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should retrieve and parse JSON from S3", async () => {
    // Mock data
    const bucket = "test-bucket";
    const key = "test-key";
    const client = {}; // Mock client object
    const responseBody = '{"key":"value"}';

    // Mock the getJSON function
    const getJSONMock = jest.fn().mockResolvedValue(responseBody);

    // Call the function being tested
    const result = await retrieveAndParseJSON(getJSONMock, bucket, key, client);

    // Assertions
    expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
    expect(result).toEqual({
      key: "value",
    }); // Check if JSON is correctly parsed
  });

  test("should throw an error if getJSON fails", async () => {
    // Mock data
    const bucket = "test-bucket";
    const key = "test-key";
    const client = {}; // Mock client object
    const error = new Error("Failed to retrieve JSON");

    // Mock the getJSON function to throw an error
    const getJSONMock = jest.fn().mockRejectedValue(error);

    // Call the function being tested and expect it to throw an error
    await expect(
      retrieveAndParseJSON(getJSONMock, bucket, key, client)
    ).rejects.toThrow(error);

    // Assertion
    expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
  });
});

describe("getJSONFromS3", () => {
  // Clear mocks before each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return JSON string when object is retrieved successfully", async () => {
    // Arrange
    const bucketName = "test-bucket";
    const key = "test-key";
    const client = new S3Client({});
    const responseBody = '{"name": "John"}';
    const response = {
      $metadata: { httpStatusCode: 200 },
      Body: { transformToString: jest.fn().mockResolvedValue(responseBody) },
    };
    const s3SendMock = jest.fn().mockResolvedValue(response);
    const s3Client = { send: s3SendMock };

    // Act
    const result = await getJSONFromS3(bucketName, key, s3Client);

    // Assert
    expect(result).toEqual(responseBody);
    expect(s3SendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  });

  test("should throw error when object retrieval fails", async () => {
    // Arrange
    const bucketName = "test-bucket";
    const key = "test-key";
    const client = new S3Client({});
    const error = new Error("Failed to retrieve object");
    const s3SendMock = jest.fn().mockRejectedValue(error);
    const s3Client = { send: s3SendMock };

    // Act & Assert
    await expect(getJSONFromS3(bucketName, key, s3Client)).rejects.toThrow(
      error
    );
    expect(s3SendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
  });
});
