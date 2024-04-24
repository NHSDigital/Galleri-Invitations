import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

import * as fs from "fs";
import path from "path";

import {
  readCsvFromS3,
  getItemsFromTable,
  createPhlebotomySite,
  saveObjToPhlebotomyTable,
  pushCsvToS3,
} from "../../gtmsUploadClinicCapacityDataLambda/gtmsUploadClinicCapacityDataLambda.js";

describe("readCsvFromS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Failed response when error occurs getting file from bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorStr = "Error: Mocked error";
    const errorMsg = new Error(errorStr);
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    const bucket = "bucketName";
    const key = "key";
    try {
      await readCsvFromS3(bucket, key, mockClient);
    } catch (err) {
      expect(err.message).toBe("Error: Mocked error");
    }

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed to read from bucketName/key");
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
});

describe("getItemsFromTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should mock call to dynamoDb successfully", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Body: "hello",
    });

    const result = await getItemsFromTable("table", mockDynamoDbClient, "key");

    expect(result.Body).toEqual("hello");
  });
});

describe("saveObjToPhlebotomyTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const meshResponsePass = {
    ClinicID: "CJ74G234",
    Schedule: [
      {
        WeekCommencingDate: "2024-02-19",
        Availability: 5,
      },
      {
        WeekCommencingDate: "2024-02-12",
        Availability: 5,
      },
      {
        WeekCommencingDate: "2024-02-05",
        Availability: 0,
      },
      {
        WeekCommencingDate: "2024-01-29",
        Availability: 8,
      },
      {
        WeekCommencingDate: "2024-01-22",
        Availability: 5,
      },
      {
        WeekCommencingDate: "2024-01-15",
        Availability: 9,
      },
    ],
  };

  test("successfully push to dynamodb", async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    const environment = "dev-1";
    const clinicName = "test_clinic";
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await saveObjToPhlebotomyTable(
      meshResponsePass,
      environment,
      mockDynamodbClient,
      clinicName
    );
    expect(result).toBe(true);
  });

  test("Failed to push to dynamodb", async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    const environment = "dev-1";
    const clinicName = "test_clinic";
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 400 },
    });
    const result = await saveObjToPhlebotomyTable(
      meshResponsePass,
      environment,
      mockDynamodbClient,
      clinicName
    );
    expect(result).toBe(false);
  });
});

describe("pushCsvToS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
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
    expect(logSpy).toHaveBeenCalledWith(
      `Successfully pushed to galleri-ons-data/test.txt`
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });
  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
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
    expect(logSpy).toHaveBeenCalledWith(
      `Error: Failed to push to galleri-ons-data/test.txt. Error Message: ${errorMsg}`
    );
  });
});
