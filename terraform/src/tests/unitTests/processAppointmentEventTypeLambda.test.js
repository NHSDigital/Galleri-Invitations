import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import AWS from "aws-sdk-mock";
import { S3Client } from "@aws-sdk/client-s3";
import {
  transactionalWrite,
  lookUp,
  readFromS3,
  pushToS3,
  sortBy
} from "../../processAppointmentEventTypeLambda/processAppointmentEventTypeLambda";

describe("transactionalWrite", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const participantId = "ID-A";
    const batchId = "B-A";
    const appointmentId = "Type-A";
    const eventType = "COMPLETE";
    const episodeEvent = "Event-A";
    const eventDescription = "Null";
    const grailId = "Grail-ID";
    const bloodCollectionDate = "Date";

    const result = await transactionalWrite(
      mockDynamoDbClient,
      participantId,
      batchId,
      appointmentId,
      eventType,
      episodeEvent,
      eventDescription
    );

    expect(result).toEqual(true);
  });
});

describe("lookUp", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does exist from query", async () => {
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

describe("S3 Operations", () => {
  test("Failed response when error occurs getting file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    try {
      await readFromS3("adwdwad", "dwadsdas", mockClient);
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
      "processed-appointments",
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
      await pushToS3(
        "processed-appointments",
        "test.txt",
        "dfsdfd",
        mockClient
      );
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed: ", errorMsg);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    AWS.mock("S3", "getObject", (params, callback) => {
      // Provide a mocked response for getObject
      callback(null, { Body: "mocked CSV data" });
    });

    AWS.mock("S3", "putObject", (params, callback) => {
      // Provide a mocked response for putObject
      callback(null, "mocked response");
    });
  });

  afterEach(() => {
    AWS.restore("S3");
  });
});

describe("sortBy", () => {
  const item1 = { Time_stamp: { S: "2024-06-23T10:00:00.000Z" } };
  const item2 = { Time_stamp: { S: "2024-05-23T10:00:00.000Z" } };
  const item3 = { Time_stamp: { S: "2024-05-23T08:00:00.000Z" } };
  const item4 = { Time_stamp: { S: "2024-06-21T08:00:00.000Z" } };
  const arr = [
    item1,
    item2,
    item3,
    item4,
  ];
  test("Should sort by field ascending correctly", async () => {
    const sorted = sortBy(arr, "Time_stamp", "S");
    expect(sorted[0]).toEqual(item3);
    expect(sorted[1]).toEqual(item2);
    expect(sorted[2]).toEqual(item4);
    expect(sorted[3]).toEqual(item1);
  });

  test("Should sort by field descending correctly", async () => {
    const sorted = sortBy(arr, "Time_stamp", "S", false);
    expect(sorted[0]).toEqual(item1);
    expect(sorted[1]).toEqual(item4);
    expect(sorted[2]).toEqual(item2);
    expect(sorted[3]).toEqual(item3);
  });
});
