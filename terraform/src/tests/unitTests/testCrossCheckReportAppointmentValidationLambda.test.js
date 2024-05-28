import { mockClient } from "aws-sdk-client-mock";
import {
  processTRR,
  validateTRR,
  getJSONFromS3,
  retrieveAndParseJSON,
  putTRRInS3Bucket,
  deleteTRRinS3Bucket,
  lookUp,
} from "../../testCrossCheckReportAppointmentValidationLambda/testCrossCheckReportAppointmentValidationLambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
jest.mock("axios");
import axios from "axios";

const fhirPayload = {
  Grail_Id: "E01023942",
  Participant_Id: "NHS-AM78-RX14",
  Blood_Collection_Date: "22024-05-23T19:19:12.939Z",
};

const errorIssues = {
  issue: [
    {
      severity: "error",
      diagnostics: "error1",
    },
    {
      severity: "info",
      diagnostics: "info1",
    },
    {
      severity: "error",
      diagnostics: "error2",
    },
    {
      severity: "info",
      diagnostics: "info2",
    },
  ],
};

const noErrorIssues = {
  issue: [
    {
      severity: "info",
      diagnostics: "info1",
    },
    {
      severity: "info",
      diagnostics: "info2",
    },
  ],
};

describe("processTRR", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should process valid TRR", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    axios.mockResolvedValueOnce({
      status: 200,
      data: noErrorIssues,
    });

    await processTRR(noErrorIssues, "report1", "bucket1", mockS3Client, true);

    expect(logSpy).toHaveBeenCalledWith(
      "Successfully pushed to undefined/report1"
    );
    expect(logSpy).toHaveBeenCalledWith(
      "Successfully deleted report1 from bucket1"
    );
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  test("should process invalid TRR", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    axios.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: "Bad Request",
        data: "Invalid request",
      },
    });

    await processTRR(errorIssues, "report1", "bucket1", mockS3Client, false);

    expect(logSpy).toHaveBeenCalledWith(
      "Successfully pushed to undefined/report1"
    );
    expect(logSpy).toHaveBeenCalledWith(
      "Successfully deleted report1 from bucket1"
    );
    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});

describe("validateTRR", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Should expect valid TRR message", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    axios.mockResolvedValueOnce({
      status: 200,
      data: true,
    });

    const appointmentParticipantItems = {
      blood_collection_date: {
        S: "22024-05-23T19:19:12.939Z",
      },
      grail_id: {
        S: "E01023942",
      },
      Participant_Id: {
        S: "NHS-AM78-RX14",
      },
    };

    const result = await validateTRR(fhirPayload, appointmentParticipantItems);

    expect(result).toBeTruthy();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Move TRR to the 'Step 3 validated successfully bucket"
    );
  });

  test("Should expect invalid TRR message", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    axios.mockResolvedValueOnce({
      status: 200,
      data: false,
    });

    const appointmentParticipantItems = {
      blood_collection_date: {
        S: "2020-09-23T11:00:00+00:00",
      },
      grail_id: {
        S: "NHS9123123",
      },
      Participant_Id: {
        S: "NHS-AB12-CD30",
      },
    };

    const result = await validateTRR(fhirPayload, appointmentParticipantItems);

    expect(result).toBe(false);
    expect(logSpy).toHaveBeenCalledWith(
      "Move TRR to the 'Step 3 validated unsuccessful bucket"
    );
  });
});

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

describe("lookUp", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does not exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result.Items).toEqual(["I exist"]);
  });

  test("should return unsuccessful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result.Items).toEqual([]);
  });
});
