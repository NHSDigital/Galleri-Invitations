import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import * as fs from "fs";
import path from "path";

import {
  readCsvFromS3,
  pushCsvToS3,
  lookupParticipantId,
  lookupParticipant,
  saveObjToEpisodeTable,
} from "../../gtmsStatusUpdateLambda/gtmsStatusUpdateLambda.js";

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

describe("lookupParticipant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const environment = "dev-1";
  test("return participant", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const item = {
      Withdrawal: {
        ParticipantID: "NHS-AC35-BS33",
        Withdrawn: true,
        Reason: "CLINICAL_REASON",
      },
    };
    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [item],
    });
    const participant = await lookupParticipant(
      "id",
      "Population",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual(true);
  });

  test("participant not found", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const participant = await lookupParticipant(
      "id",
      "Population",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual(false);
  });

  test("http error status", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 400,
      },
    });

    const participant = await lookupParticipant(
      "id",
      "Population",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual(false);
  });
});

describe("lookupParticipantId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const environment = "dev-1";
  test("return participant", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
    const item = {
      Batch_Id: {
        S: "123",
      },
    };
    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [item],
    });
    const participant = await lookupParticipantId(
      "id",
      "Episode",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual("123");
  });

  test("participant not found", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const participant = await lookupParticipantId(
      "id",
      "Episode",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual("");
  });

  test("http error status", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient.on(QueryCommand).resolves({
      $metadata: {
        httpStatusCode: 400,
      },
    });

    const participant = await lookupParticipantId(
      "id",
      "Episode",
      mockDynamoDbClient,
      environment
    );
    expect(participant).toEqual("");
  });
});

describe("saveObjToEpisodeTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  const environment = "dev-1";
  const meshResponsePass = {
    Withdrawal: {
      ParticipantID: "NHS-AC35-BS33",
      Withdrawn: true,
      Reason: "CLINICAL_REASON",
    },
  };
  test("successfully push to dynamodb", async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await saveObjToEpisodeTable(
      meshResponsePass,
      environment,
      mockDynamodbClient
    );
    expect(result).toBe(true);
  });

  test("Failed to push to dynamodb", async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 400 },
    });
    const result = await saveObjToEpisodeTable(
      meshResponsePass,
      environment,
      mockDynamodbClient
    );
    expect(result).toBe(false);
  });
});
