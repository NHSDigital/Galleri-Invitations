import { mockClient } from 'aws-sdk-client-mock';
import { processTRR, validateTRR, getSecret, getJSONFromS3, retrieveAndParseJSON, responseHasErrors, putTRRInS3Bucket, deleteTRRinS3Bucket } from '../../testResultReportFhirValidationLambda/testResultReportFhirValidationLambda';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
jest.mock('axios');
import axios from 'axios';

const errorIssues = {
  issue: [
  {
    severity: "error",
    diagnostics: "error1"
  },
  {
    severity: "info",
    diagnostics: "info1"
  },
  {
    severity: "error",
    diagnostics: "error2"
  },
  {
    severity: "info",
    diagnostics: "info2"
  }
]};

const noErrorIssues = {
  issue: [
    {
      severity: "info",
      diagnostics: "info1"
    },
    {
      severity: "info",
      diagnostics: "info2"
    }
  ]
};

describe("processTRR", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should process valid TRR', async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    axios.mockResolvedValueOnce({
      status: 200,
      data: noErrorIssues
    });

    await processTRR(noErrorIssues, "report1", "bucket1", mockS3Client);

    expect(logSpy).toHaveBeenCalledWith('FHIR validation successful for report1');
    expect(logSpy).toHaveBeenCalledWith('Successfully pushed to undefined/report1');
    expect(logSpy).toHaveBeenCalledWith('Successfully deleted report1 from bucket1');
    expect(logSpy).toHaveBeenCalledTimes(3);
  });

  test('should process invalid TRR', async () => {
    const errorSpy = jest.spyOn(global.console, "error");
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    axios.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: 'Bad Request',
        data: 'Invalid request'
      }
    });

    await processTRR(errorIssues, "report1", "bucket1", mockS3Client);

    expect(errorSpy).toHaveBeenCalledWith('Error: Unsuccessful request to FHIR validation service for report1 - Status 400 - Error body: Invalid request');
    expect(logSpy).toHaveBeenCalledWith('Successfully pushed to undefined/report1');
    expect(logSpy).toHaveBeenCalledWith('Successfully deleted report1 from bucket1');
    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});

describe("validateTRR", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Should expect success response", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    axios.mockResolvedValueOnce({
      status: 200,
      data: noErrorIssues
    });

    const result = await validateTRR({}, "report1", "mockUrl");

    expect(result).toBeTruthy();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("FHIR validation successful for report1");

  });

  test("Should expect unsuccessful validation", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    axios.mockResolvedValueOnce({
      status: 200,
      data: errorIssues
    });

    const result = await validateTRR({}, "report1", "mockUrl");

    expect(result).toBeFalsy();
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenCalledWith('Error: FHIR validation unsuccessful for report1 - Status 200');
  });

  test("Should expect failed request to service with response", async() => {
    const logSpy = jest.spyOn(global.console, "error");
    axios.mockRejectedValueOnce({
      response: {
        status: 400,
        statusText: 'Bad Request',
        data: 'Invalid request'
      }
    });

    const result = await validateTRR({}, "report1", "mockUrl");

    expect(result).toBeFalsy();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Error: Unsuccessful request to FHIR validation service for report1 - Status 400 - Error body: Invalid request');
  });

  test("Should expect failed request to service without response", async() => {
    const logSpy = jest.spyOn(global.console, "error");
    axios.mockRejectedValueOnce({});

    const result = await validateTRR({}, "report1", "mockUrl");

    expect(result).toBeFalsy();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Error: Unsuccessful request to FHIR validation service for report1 - : Error: undefined');
  });
});

describe("deleteTRRinS3Bucket", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("should successfully put TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });

    const result = await deleteTRRinS3Bucket('report1', 'bucket1', mockS3Client);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Successfully deleted report1 from bucket1");
  });

  test("should fail to put TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    let errorCaught = false;

    try {
      await deleteTRRinS3Bucket('report1', 'bucket1', mockS3Client);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Error: deleting report1 from bucket1: Error: Mocked error");
      errorCaught = true;
    };

    expect(errorCaught).toBeTruthy();
  });
});

describe("putTRRinS3Bucket", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("should successfully put TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const mockTRR = {
      "key": "value"
    }

    const result = await putTRRInS3Bucket(mockTRR, 'report1', 'bucket1', mockS3Client);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Successfully pushed to bucket1/report1");
  });

  test("should fail to put TRR in bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    const mockTRR = {
      "key": "value"
    }
    let errorCaught = false;

    try {
      await putTRRInS3Bucket(mockTRR, 'report1', 'bucket1', mockS3Client);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith("Error: Failed to push to bucket1/report1. Error Message: Error: Mocked error")
      errorCaught = true;
    };

    expect(errorCaught).toBeTruthy();
  });
});

describe("responseHasErrors", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return true when error issues are present", () => {
    const logSpy = jest.spyOn(global.console, "error");
    const hasErrors = responseHasErrors(errorIssues, "report1");
    expect(hasErrors).toBeTruthy();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith("Error: FHIR diagnostic message for report1 : error1");
    expect(logSpy).toHaveBeenCalledWith("Error: FHIR diagnostic message for report1 : error2");
  });

  test("should return false if no error issues are present", () => {
    const logSpy = jest.spyOn(global.console, "error");
    const hasErrors = responseHasErrors(noErrorIssues, "report1");
    expect(hasErrors).toBeFalsy();
    expect(logSpy).toHaveBeenCalledTimes(0);
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
    const responseBody =
      '{"key":"value"}';

    // Mock the getJSON function
    const getJSONMock = jest.fn().mockResolvedValue(responseBody);

    // Call the function being tested
    const result = await retrieveAndParseJSON(getJSONMock, bucket, key, client);

    // Assertions
    expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
    expect(result).toEqual({
      key: "value"
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

describe ("getJSONFromS3", () => {
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

describe("getSecret", () => {
  const mockSecretName = "mocked_secret_name";
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should return secret value when successful", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const expectedResult = "mocked_private_key";
    const smClient = {
      send: jest
        .fn()
        .mockResolvedValue({ SecretString: "mocked_private_key" }),
    };

    const result = await getSecret(mockSecretName, smClient);

    expect(result).toEqual(expectedResult);
    expect(logSpy).toHaveBeenCalledWith(
      `Retrieved value successfully ${mockSecretName}`
    );
  });
  test("Failure when retrieving secret", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Failed to retrieve secret to S3");
    const smClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await getSecret("abc", smClient);
    } catch (error) {
      expect(error.message).toBe("Failed to retrieve secret to S3");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Error: Failed to retrieve abc"
    );
  });
});
