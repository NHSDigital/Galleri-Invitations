import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { generateMessageReference, generateJWT, getSecret, getAccessToken, deleteMessageInQueue, putItemIntoTable, putSuccessResponseIntoTable, putFailedResponseIntoTable, sendSingleMessage, processRecords } from '../../sendSingleNotifyMessageLambda/sendSingleNotifyMessageLambda';
import { mockClient } from 'aws-sdk-client-mock';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import nodeFetch from 'node-fetch';

jest.mock('axios');
jest.mock('node-fetch');
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mocked_signed_jwt"),
}));

describe('processRecords', () => {
  const token = {
    access_token: 'accessToken123'
  };

  const fiveValidRecords = [
    {
      receiptHandle: 'receiptHandle1',
      body: '{"participantId":"NHS-EU44-JN11","nhsNumber":"9000232301","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'
    },
    {
      receiptHandle: 'receiptHandle2',
      body: '{"participantId":"NHS-EU44-JN12","nhsNumber":"9000232302","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle3',
      body: '{"participantId":"NHS-EU44-JN13","nhsNumber":"9000232303","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle4',
      body: '{"participantId":"NHS-EU44-JN14","nhsNumber":"9000232304","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle5',
      body: '{"participantId":"NHS-EU44-JN15","nhsNumber":"9000232305","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'
    }
  ];

  const fiveValidAndInvalidRecords = [
    {
      receiptHandle: 'receiptHandle1',
      body: '{"participantId":"NHS-EU44-JN11","nhsNumber":"9000232301","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'
    },
    {
      receiptHandle: 'receiptHandle2',
      body: '{"participantId":"NHS-EU44-JN12","nhsNumber":"9000232302","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle3',
      body: '{"participantId":"NHS-EU44-JN13","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle4',
      body: '{"participantId":"NHS-EU44-JN14","episodeEvent":"Invited","routingId":"4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"}'

    },
    {
      receiptHandle: 'receiptHandle5',
      body: '{"participantId":"NHS-EU44-JN15","nhsNumber":"9000232305","episodeEvent":"Invited"}'
    }
  ];

  let mockDynamoClient;
  let mockSQSClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDynamoClient = mockClient(new DynamoDBClient({}));
    mockSQSClient = mockClient(new SQSClient({}));
  });

  afterEach(() => {
    mockDynamoClient.reset();
    mockSQSClient.reset();
  });

  test('should process batch of valid records', async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const response = {
      data: {
        id: 'id1'
      },
    };

    nodeFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const mockResponse = {
      ConsumedCapacity: { TableName: 'NotifySendMessageStatus' },
      $metadata: { httpStatusCode: 200 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);

    mockSQSClient.on(DeleteMessageCommand).resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: '456',
    });

    await processRecords(fiveValidRecords, token, mockDynamoClient, mockSQSClient);

    expect(mockDynamoClient.calls().length).toBe(5);
    expect(mockSQSClient.calls().length).toBe(5);

    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 5 - Records successfully processed/sent: 5 - Records failed to send: 0');
  });

  test('should process batch of valid and invalid records', async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorSpy = jest.spyOn(global.console, "error");
    const response = {
      data: {
        id: 'id1'
      },
    };

    nodeFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    });
    const mockResponse = {
      ConsumedCapacity: { TableName: 'NotifySendMessageStatus' },
      $metadata: { httpStatusCode: 200 }
    };
    mockDynamoClient.on(PutItemCommand).resolves(mockResponse);
    mockSQSClient.on(DeleteMessageCommand).resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: '456',
    });

    await processRecords(fiveValidAndInvalidRecords, token, mockDynamoClient, mockSQSClient);

    expect(mockDynamoClient.calls().length).toBe(2);
    expect(mockSQSClient.calls().length).toBe(2);

    expect(errorSpy).toHaveBeenCalledWith("Error: Not able to process participant NHS-EU44-JN13 due to error NHS Number is undefined");
    expect(errorSpy).toHaveBeenCalledWith("Error: Not able to process participant NHS-EU44-JN14 due to error NHS Number is undefined");
    expect(errorSpy).toHaveBeenCalledWith("Error: Not able to process participant NHS-EU44-JN15 due to error Routing Id is undefined");
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 5 - Records successfully processed/sent: 2 - Records failed to send: 3');
  });
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

describe('getAccessToken', () => {
  it('should call axios with the correct arguments and return the expected access token', async () => {
    const tokenEndpointUrl = 'https://example.com/api/token';
    const signedJWT = 'mocked-signed-jwt-token';
    const accessToken = 'mocked-access-token';
    const mockResponse = {
      'access_token': accessToken
    };

    axios.mockResolvedValueOnce({
      status: 200,
      data: mockResponse
    });

    const result = await getAccessToken(tokenEndpointUrl, signedJWT);
    expect(result).toEqual({ access_token: accessToken });
  });

  it('should call axios with the correct arguments and return the undefined if we see a non 200 status code', async () => {
    const tokenEndpointUrl = 'https://example.com/api/token';
    const signedJWT = 'mocked-signed-jwt-token';

    axios.mockResolvedValueOnce({
      status: 500
    });

    const result = await getAccessToken(tokenEndpointUrl, signedJWT);
    expect(result).toEqual(undefined);
  });
});

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
  const messageReferenceId = 'c58356a0-4d66-4f08-b8dc-b7cc0bc285a7';
  const messagesEndpoint = 'https://example.com/api/';
  const initialRetryDelay = 1;
  const maxRetries = 3;
  const token = {
    access_token: 'accessToken123'
  };

  test('should return a successful response', async () => {
    let logSpy = jest.spyOn(global.console, "log");
    const response = {
      field1: 'value1'
    };
    const messageBody = {
      nhsNumber: 'nhsNumber123',
      routingId: 'routingId123',
      participantId: 'participantId123',
      episodeEvent: 'Invited'
    };

    nodeFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const {responseObject, numberOfAttempts} = await sendSingleMessage(messageBody, token, messageReferenceId, messagesEndpoint, initialRetryDelay, maxRetries);
    expect(numberOfAttempts).toBe(1);
    expect(responseObject).toBe(response);
    expect(logSpy).toHaveBeenCalledWith('Sent message for participant participantId123 to NHS Notify');
  });

  test('should return a failed response for a 400 status code error', async () => {
    let logSpy = jest.spyOn(global.console, "error");
    const response = {
      errorDetails: {
        'error': 'errorMessage'
      }
    };
    const messageBody = {
      nhsNumber: 'nhsNumber123',
      routingId: 'routingId123',
      participantId: 'participantId123',
      episodeEvent: 'Invited'
    };
    let errorCaught = false;

    nodeFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve(response),
    });

    try {
      await sendSingleMessage(messageBody, token, messageReferenceId, messagesEndpoint, initialRetryDelay, maxRetries);
    } catch (error) {
      expect(error.status).toBe(400);
      expect(error.details).toBe("{\"errorDetails\":{\"error\":\"errorMessage\"}}");
      expect(error.numberOfAttempts).toBe(1);
      expect(new Date(error.messageSent).toISOString()).toEqual(error.messageSent);
      errorCaught = true;
    };

    expect(errorCaught).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('Error: Failed request to NHS Notify after 1 attempt(s) for participant participantId123');
  });

  test('should return a failed response after 4 total request attempts', async () => {
    let errorSpy = jest.spyOn(global.console, "error");
    let logSpy = jest.spyOn(global.console, "log");
    const messageBody = {
      nhsNumber: 'nhsNumber123',
      routingId: 'routingId123',
      participantId: 'participantId123',
      episodeEvent: 'Invited'
    };
    let errorCaught = false;

    nodeFetch
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error 1' }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error 2' }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error 3' }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'Internal Server Error 4' }),
    });

    try {
      await sendSingleMessage(messageBody, token, messageReferenceId, messagesEndpoint, initialRetryDelay, maxRetries);
    } catch (error) {
      expect(error.status).toBe(500);
      expect(error.details).toBe("{\"message\":\"Internal Server Error 4\"}");
      expect(error.numberOfAttempts).toBe(4);
      expect(new Date(error.messageSent).toISOString()).toEqual(error.messageSent);
      errorCaught = true;
    };

    expect(errorCaught).toBe(true);
    expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 1');
    expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 2');
    expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 3');
    expect(logSpy).not.toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 4');
    expect(errorSpy).toHaveBeenCalledWith('NHS Notify request failed for participant participantId123 with status code 500');
    expect(errorSpy).toHaveBeenCalledWith('Error: Failed request to NHS Notify after 4 attempt(s) for participant participantId123');
    });

    test('should return a successful response on the 4th request attempt', async () => {
      let logSpy = jest.spyOn(global.console, "log");
      let errorSpy = jest.spyOn(global.console, "error");
      const messageBody = {
        nhsNumber: 'nhsNumber123',
        routingId: 'routingId123',
        participantId: 'participantId123',
        episodeEvent: 'Invited'
      };
      const response = {
        field1: 'value1'
      };

      nodeFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error 1' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error 2' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal Server Error 3' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response),
      });


      const {responseObject, numberOfAttempts} = await sendSingleMessage(messageBody, token, messageReferenceId, messagesEndpoint, initialRetryDelay, maxRetries);
      expect(numberOfAttempts).toBe(4);
      expect(responseObject).toBe(response);
      expect(errorSpy).toHaveBeenCalledWith('NHS Notify request failed for participant participantId123 with status code 500');
      expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 1');
      expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 2');
      expect(logSpy).toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 3');
      expect(logSpy).not.toHaveBeenCalledWith('Retrying request for participant participantId123 to NHS Notify, Attempt: 4');
      expect(logSpy).toHaveBeenCalledWith('Sent message for participant participantId123 to NHS Notify');
    });
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
    let errorCaught = false;

    try {
      await deleteMessageInQueue(mockMessage,mockRecord,mockQueue,mockSQSClient);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledWith(`Error: Failed to delete message: 12345 for participant Id: NHS-EU44-JN48 with episode event Invited`);
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });
});
