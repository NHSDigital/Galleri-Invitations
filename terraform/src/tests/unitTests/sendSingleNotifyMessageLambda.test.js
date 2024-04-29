import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { generateMessageReference, generateJWT, getSecret, getAccessToken, deleteMessageInQueue, putItemIntoTable, putSuccessResponseIntoTable, putFailedResponseIntoTable } from '../../sendSingleNotifyMessageLambda/sendSingleNotifyMessageLambda';
import { mockClient } from 'aws-sdk-client-mock';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mocked_signed_jwt"),
}));

describe('processRecords', () => {

});

describe('getSecret', () => {
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
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Failed to retrieve secret to S3");
    const smClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      const response = await getSecret("MESH_SENDER_CERT", smClient);
    } catch (error) {
      expect(error.message).toBe("Failed to retrieve secret to S3");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Failed: Error: Failed to retrieve secret to S3"
    );
  });
});

describe('generateJWT', () => {

  test("should generate JWT", () => {
    const apiKey = "mocked_api_key";
    const tokenEndpointUrl = "mocked_token_endpoint_url";
    const publicKeyId = "mocked_kid";
    const privateKey = "mocked_private_key";

    const token = generateJWT(
      apiKey,
      tokenEndpointUrl,
      publicKeyId,
      privateKey
    );

    expect(token).toBeTruthy();
  });
});

// describe('getAccessToken', () => {
//   it('should call axios.post with the correct arguments and return the expected access token', async () => {
//     const tokenEndpointUrl = 'https://example.com/api/token';
//     const signedJWT = 'mocked-signed-jwt-token';
//     const accessToken = 'mocked-access-token';

//     const result = await getAccessToken(tokenEndpointUrl, signedJWT);

//     expect(result).toEqual({ access_token: accessToken });
//   });
// });

describe('putSuccessResponseIntoTable', () => {
  let mockDynamoClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDynamoClient = mockClient(new DynamoDBClient({}));
  });

  afterEach(() => {
    mockDynamoClient.reset();
  });

  test('should return the correct response', async () => {
    let logSpy = jest.spyOn(global.console, "log");

    const messageBody = {
      participantId:'NHS-EU44-JN48',
      nhsNumber:'9728543972',
      episodeEvent:'Invited',
      routingId:'a91601f5-ed53-4472-bbaa-580f418c7091'
    };
    const messageSentAt = '2024-04-29T14:26:02.238Z';
    const numberOfAttempts = 1;
    const responseBody = {
      id: '123456',
    }
    const messageReferenceId = 'mock-message-reference-id';
    const table = 'NotifySendMessageStatus';

    const mockResponse = {
      ConsumedCapacity: { TableName: table },
      $metadata: { httpStatusCode: 200 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    await putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, table, mockDynamoClient);

    expect(mockDynamoClient.calls()).toHaveLength(1);

    expect(logSpy).toHaveBeenCalledWith(`Added successful result record for NHS-EU44-JN48 in NotifySendMessageStatus`);
  });

  test('should return error from dynamodb', async () => {
    const messageBody = {
      participantId:'NHS-EU44-JN48',
      nhsNumber:'9728543972',
      episodeEvent:'Invited',
      routingId:'a91601f5-ed53-4472-bbaa-580f418c7091'
    };
    const messageSentAt = '2024-04-29T14:26:02.238Z';
    const numberOfAttempts = 1;
    const responseBody = {
      id: '123456',
    }
    const messageReferenceId = 'mock-message-reference-id';
    const table = 'NotifySendMessageStatus';

    const mockResponse = {
      ConsumedCapacity: { TableName: table },
      $metadata: { httpStatusCode: 500 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    try {
      await putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, table, mockDynamoClient);
    } catch (error) {
      expect(mockDynamoClient.calls()).toHaveLength(1);
      expect(error.message).toBe('Error with adding success record for participant NHS-EU44-JN48 in NotifySendMessageStatus');
    }
  });
});

describe('putFailedResponseIntoTable', () => {
  let mockDynamoClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDynamoClient = mockClient(new DynamoDBClient({}));
  });

  afterEach(() => {
    mockDynamoClient.reset();
  });

  test('should return the correct response', async () => {
    let logSpy = jest.spyOn(global.console, "log");

    const messageBody = {
      participantId:'NHS-EU44-JN48',
      nhsNumber:'9728543972',
      episodeEvent:'Invited',
      routingId:'a91601f5-ed53-4472-bbaa-580f418c7091'
    };
    const messageSentAt = '2024-04-29T14:26:02.238Z';
    const numberOfAttempts = 1;
    const statusCode = '400';
    const errorDetails = 'mockErrorDetails';
    const messageReferenceId = 'mock-message-reference-id';
    const table = 'NotifySendMessageStatus';

    const mockResponse = {
      ConsumedCapacity: { TableName: table },
      $metadata: { httpStatusCode: 200 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    await putFailedResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, statusCode, errorDetails,  messageReferenceId, table, mockDynamoClient);

    expect(mockDynamoClient.calls()).toHaveLength(1);

    expect(logSpy).toHaveBeenCalledWith(`Added failed result record for NHS-EU44-JN48 in NotifySendMessageStatus`);
  });

  test('should return error from dynamodb', async () => {
    const messageBody = {
      participantId:'NHS-EU44-JN48',
      nhsNumber:'9728543972',
      episodeEvent:'Invited',
      routingId:'a91601f5-ed53-4472-bbaa-580f418c7091'
    };
    const messageSentAt = '2024-04-29T14:26:02.238Z';
    const numberOfAttempts = 1;
    const statusCode = '400';
    const errorDetails = 'mockErrorDetails';
    const messageReferenceId = 'mock-message-reference-id';
    const table = 'NotifySendMessageStatus';

    const mockResponse = {
      ConsumedCapacity: { TableName: table },
      $metadata: { httpStatusCode: 500 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    try {
      await putFailedResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, statusCode, errorDetails, messageReferenceId, table, mockDynamoClient);
    } catch (error) {
      expect(mockDynamoClient.calls()).toHaveLength(1);
      expect(error.message).toBe('Error with adding failed record for participant NHS-EU44-JN48 in NotifySendMessageStatus');
    }
  });
});

describe('putItemIntoTable', () => {
  let mockDynamoClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDynamoClient = mockClient(new DynamoDBClient({}));
  });

  afterEach(() => {
    mockDynamoClient.reset();
  });

  test('should return the correct response', async () => {
    const mockTableName = 'NotifySendMessageStatus';
    const mockResponse = { ConsumedCapacity: { TableName: mockTableName } };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    const item = { id: { S: '123' }, name: { S: 'Test Item' } };
    await putItemIntoTable(item, mockTableName, mockDynamoClient);

    expect(mockDynamoClient.calls()).toHaveLength(1);
    const input = mockDynamoClient.calls()[0].args[0].input;
    const responseItem = input.Item;
    const responseTableName = input.TableName;

    expect(responseItem).toEqual(item);
    expect(responseTableName).toEqual('undefined-NotifySendMessageStatus');
  });


  test('should throw an error if putItemCommand fails', async () => {
    let logSpy = jest.spyOn(global.console, "error");
    const mockTableName = 'NotifySendMessageStatus';
    const mockError = new Error('DynamoDB error');
    mockDynamoClient.on(PutItemCommand).rejects(mockError);

    const item = { id: { S: '123' }, name: { S: 'Test Item' } };

    try {
      await putItemIntoTable(item, mockTableName, mockDynamoClient);
    } catch(error) {
      expect(error).toBe(mockError);
      expect(logSpy).toHaveBeenCalledWith(`Error: Error with putting record into table NotifySendMessageStatus`);
    }
  });
});

describe('generateMessageReference', () => {
  it('should return a unique message reference ID', async () => {
    const messageReferenceId = await generateMessageReference();
    expect(messageReferenceId).toBeTruthy();
    expect(messageReferenceId).toHaveLength(36);
  });

  it('should return a different message reference ID each time it is called', async () => {
    const messageReferenceId1 = await generateMessageReference();
    const messageReferenceId2 = await generateMessageReference();
    expect(messageReferenceId1).not.toBe(messageReferenceId2);
  });
});

describe('sendSingleMessage', () => {

});

describe('deleteMessageInQueue', () => {
  let mockSQSClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockSQSClient = mockClient(new SQSClient({}));
  });

  afterEach(() => {
    mockSQSClient.reset();
  });

  test('Successful message deleted', async () => {
    let logSpy = jest.spyOn(global.console, "log");
    mockSQSClient.on(DeleteMessageCommand).resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: '456',
    });

    const mockMessage = {
      participantId:"NHS-EU44-JN48",
      nhsNumber:"9728543972",
      episodeEvent:"Invited",
      routingId:"a91601f5-ed53-4472-bbaa-580f418c7091"
    };
    const mockRecord = { messageId: '12345', receiptHandle: '12345'};
    const mockQueue = 'https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo';


    await deleteMessageInQueue(mockMessage,mockRecord,mockQueue,mockSQSClient);

    // Expects
    expect(logSpy).toHaveBeenCalledWith(`Deleted message with id 12345 for participant Id: NHS-EU44-JN48 with episode event Invited from the enriched message queue.`);
    expect(mockSQSClient.commandCalls(DeleteMessageCommand).length).toEqual(1);
  });

  test('Message unsuccessfully deleted', async () => {
    let logSpy = jest.spyOn(global.console, "error");
    mockSQSClient.on(DeleteMessageCommand).rejects(new Error('Failed to send message'));
    const mockMessage = {
      participantId:"NHS-EU44-JN48",
      nhsNumber:"9728543972",
      episodeEvent:"Invited",
      routingId:"a91601f5-ed53-4472-bbaa-580f418c7091"
    };
    const mockRecord = { messageId: '12345', receiptHandle: '12345'};
    const mockQueue = 'https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo';

    try {
      await deleteMessageInQueue(mockMessage,mockRecord,mockQueue,mockSQSClient);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledWith(`Error: Failed to delete message: 12345 for participant Id: NHS-EU44-JN48 with episode event Invited`);
    }
  });
});
