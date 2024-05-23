import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import * as fs from "fs";
import path from "path";

import {
  readCsvFromS3,
  pushCsvToS3,
  lookUp,
  transactionalWrite,
  sortBy,
} from "../../appointmentsEventCancelledLambda/appointmentsEventCancelledLambda.js";

describe("readCsvFromS3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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

describe("pushCsvToS3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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
      `Failed to push to galleri-ons-data/test.txt. Error Message: ${errorMsg}`
    );
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

describe("transactionalWrite", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("Return successful response if participant exists", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const participantId = "NHS-12345";
    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const eventType = "CANCELLED";
    const appointmentTimestamp = "2024-05-14T15:04:05.999Z"
    const episodeEvent = "Appointment Cancelled by Participant - Withdrawn";
    const eventDescription = "example";

    const result = await transactionalWrite(
      mockDynamoDbClient,
      participantId,
      batchId,
      appointmentId,
      eventType,
      appointmentTimestamp,
      episodeEvent,
      eventDescription
    );

    expect(result).toEqual(true);
  });

  test("Return unsuccessful response if participant does not exist", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400,
      },
      Items: [],
    });

    const participantId = "NHS-12345";
    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const eventType = "CANCELLED";
    const appointmentTimestamp = "2024-05-14T15:04:05.999Z"
    const episodeEvent = "Appointment Cancelled by Participant - Withdrawn";
    const eventDescription = "example";

    const result = await transactionalWrite(
      mockDynamoDbClient,
      participantId,
      batchId,
      appointmentId,
      eventType,
      appointmentTimestamp,
      episodeEvent,
      eventDescription
    );

    expect(result).toEqual(false);
  });
});

describe("sortBy", () => {
  const item1 = {Timestamp: "2024-06-23T10:00:00.000Z"};
  const item2 = {Timestamp: "2024-05-23T10:00:00.000Z"};
  const item3 = {Timestamp: "2024-05-23T08:00:00.000Z"};
  const item4 = {Timestamp: "2024-06-21T08:00:00.000Z"};
  const arr = [
    item1,
    item2,
    item3,
    item4,
  ];
  test("Should sort by field ascending correctly", async () => {
    const sorted = sortBy(arr, "Timestamp");
    expect(sorted[0]).toEqual(item3);
    expect(sorted[1]).toEqual(item2);
    expect(sorted[2]).toEqual(item4);
    expect(sorted[3]).toEqual(item1);
  });

  test("Should sort by field descending correctly", async () => {
    const sorted = sortBy(arr, "Timestamp", false);
    expect(sorted[0]).toEqual(item1);
    expect(sorted[1]).toEqual(item4);
    expect(sorted[2]).toEqual(item2);
    expect(sorted[3]).toEqual(item3);
  });
});
