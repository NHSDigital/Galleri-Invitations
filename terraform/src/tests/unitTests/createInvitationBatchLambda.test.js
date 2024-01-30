import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

import {
  extractParticipantIds,
  lookupParticipant,
  getInvitationBatch,
  pushJsonToS3
} from '../../createInvitationBatchLambda/createInvitationBatchLambda.js';

describe("extractParticipantIds", () => {
  test("return array", async () => {
    const records = [
      {
        "dynamodb": { "NewImage": { "Participant_Id": { "S": "NHS-AA11-AA11" } } }
      },
      {
        "dynamodb": { "NewImage": { "Participant_Id": { "S": "NHS-BB11-BB11" } } }
      },
      {
        "dynamodb": { "NewImage": { "Participant_Id": { "S": "NHS-CC11-CC11" } } }
      }
    ];

    const ids = extractParticipantIds(records);
    expect(ids.length).toEqual(records.length);
    expect(ids.includes(records[0].dynamodb.NewImage.Participant_Id.S)).toBe(true);
    expect(ids.includes(records[1].dynamodb.NewImage.Participant_Id.S)).toBe(true);
    expect(ids.includes(records[0].dynamodb.NewImage.Participant_Id.S)).toBe(true);
  });

  test("return empty array", async () => {
    const records = [];

    const ids = extractParticipantIds(records);
    expect(ids.length).toEqual(records.length);
  });
});

describe("lookupParticipant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("return participant", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const item = {
      "nhs_number": { "S": "123" },
      "superseded_by_nhs_number": { "S": "0" },
      "date_of_birth": { "S": "2000-01-01" }
    };
    mockDynamoDbClient
      .on(QueryCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Items": [ item ]
      });

    const participant = await lookupParticipant(mockDynamoDbClient, "env", "id");
    expect(participant).toEqual(item);
  });

  test("participant not found", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
    const errorSpy = jest.spyOn(global.console, 'error');

    mockDynamoDbClient
      .on(QueryCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Items": []
      });

    const participant = await lookupParticipant(mockDynamoDbClient, "env", "id");
    expect(participant).toEqual(undefined);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  test("http error status", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
    const errorSpy = jest.spyOn(global.console, 'error');

    mockDynamoDbClient
      .on(QueryCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 400
        }
      });

    const participant = await lookupParticipant(mockDynamoDbClient, "env", "id");
    expect(participant).toEqual(undefined);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getInvitationBatch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("return batch", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const item = {
      "nhs_number": { "S": "123" },
      "superseded_by_nhs_number": { "S": "0" },
      "date_of_birth": { "S": "2000-01-01" }
    };
    const ids = ["id1", "id2"];
    const batchItem = { "nhsNumber": item.nhs_number.S, "dateOfBirth": item.date_of_birth.S };
    mockDynamoDbClient
      .on(QueryCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Items": [ item ]

      });

    const batch = await getInvitationBatch(mockDynamoDbClient, "env", ids);
    expect(batch.length).toEqual(ids.length);
    batchItem.participantId = ids[0];
    expect(batch[0]).toEqual(batchItem);
    batchItem.participantId = ids[1];
    expect(batch[1]).toEqual(batchItem);
  });

  test("return empty batch", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
    const errorSpy = jest.spyOn(global.console, 'error');

    const ids = ["id1", "id2"];
    mockDynamoDbClient
      .on(QueryCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Items": []
      });

    const batch = await getInvitationBatch(mockDynamoDbClient, "env", ids);
    expect(batch.length).toEqual(0);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("pushJsonToS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("json pushed to s3", async () => {
    const logSpy = jest.spyOn(global.console, 'log');
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });

    const batchItem = { "participantId": "NHS-AA11-AA11", "nhsNumber": "123", "dateOfBirth": "2000-01-01" };
    const jsonArr = [ batchItem ];
    const result = await pushJsonToS3(mockS3Client, "bucketName", "key", jsonArr);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });

  test("error thrown for push error", async () => {
    const errorSpy = jest.spyOn(global.console, 'error');
    const errorStr = 'Error: Mocked error';
    const errorMsg = new Error(errorStr)
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    const batchItem = { "participantId": "NHS-AA11-AA11", "nhsNumber": "123", "dateOfBirth": "2000-01-01" };
    const jsonArr = [ batchItem ];

    try {
      await pushJsonToS3(mockClient, "bucketName", "key", jsonArr);
    } catch(err) {
      expect(err.message).toBe(errorStr);
    }

    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
