import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import * as fs from "fs";
import path from "path";
import {
  readCsvFromS3,
  parseCsvToArray,
  batchWriteCancerSignalOriginTable,
} from "../../cancerSignalOriginAddLambda/cancerSignalOriginAddLambda";

describe("readCsvFromS3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return string built from CSV file", async () => {
    const mockS3Client = mockClient(S3Client);
    const stream = sdkStreamMixin(
      fs.createReadStream(path.resolve(__dirname, "./testData/chunk_1.csv"))
    );

    mockS3Client.on(GetObjectCommand).resolves({
      Body: stream,
    });

    const result = await readCsvFromS3("aaaaaaa", "aaaaaaa", mockS3Client);

    const expectedResult = '"PCD2","PCDS","DOINTR","DOTERM"\n';

    expect(result).toEqual(expectedResult);
  });

  test("should throw an error when reading CSV file from S3 fails", async () => {
    const mockS3Client = mockClient(S3Client);
    const errorMessage = "Failed to read from S3";

    mockS3Client.on(GetObjectCommand).rejects(new Error(errorMessage));

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    await expect(
      readCsvFromS3("bucketName", "key", mockS3Client)
    ).rejects.toThrow(errorMessage);

    expect(mockS3Client.calls()).toHaveLength(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error: Failed to read from bucketName/key"
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("parseCsvToArray", () => {
  test("should parse CSV string to array successfully", async () => {
    const csvString = "header1,header2\nvalue1,value2\nvalue3,value4";
    const expectedArray = [
      { header1: "value1", header2: "value2" },
      { header1: "value3", header2: "value4" },
    ];

    const result = await parseCsvToArray(csvString);

    expect(result).toEqual(expectedArray);
  });
});

describe("batchWriteCancerSignalOriginTable", () => {
  const mockDynamoDBClient = mockClient(DynamoDBClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should write cancer signal origins to DynamoDB successfully", async () => {
    const cancerSignalOrigins = [
      { Cso_Result_Snomed_Code_Sorted: "123" },
      { Cso_Result_Snomed_Code_Sorted: "456" },
    ];

    mockDynamoDBClient.on(BatchWriteItemCommand).resolves({
      $metadata: { httpStatusCode: 200 },
    });

    await batchWriteCancerSignalOriginTable(
      mockDynamoDBClient,
      cancerSignalOrigins
    );
    expect(mockDynamoDBClient.calls()[0].args[0].input).toMatchObject({
      RequestItems: {
        [`${process.env.ENVIRONMENT}-CancerSignalOrigin`]: [
          {
            PutRequest: {
              Item: {
                Cso_Result_Snomed_Code_Sorted: { S: "123" },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                Cso_Result_Snomed_Code_Sorted: { S: "456" },
              },
            },
          },
        ],
      },
    });
  });

  test("should handle error when writing to DynamoDB fails", async () => {
    const cancerSignalOrigins = [
      { Cso_Result_Snomed_Code_Sorted: "123" },
      { Cso_Result_Snomed_Code_Sorted: "456" },
    ];

    const errorStatusCode = 500;
    mockDynamoDBClient.on(BatchWriteItemCommand).resolves({
      $metadata: { httpStatusCode: errorStatusCode },
    });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    await batchWriteCancerSignalOriginTable(
      mockDynamoDBClient,
      cancerSignalOrigins
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Error: Batch 1 failed with status code ${errorStatusCode}`
    );
    consoleErrorSpy.mockRestore();
  });
});
