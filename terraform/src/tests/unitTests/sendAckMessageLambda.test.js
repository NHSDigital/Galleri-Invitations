import { mockClient } from "aws-sdk-client-mock";
import { getSecret, readSecret, deleteMessageInQueue, sendMessageToMesh, buildMessage, processRecords } from "../../sendAckMessageLambda";
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { handShake, readMessage } from "nhs-mesh-client";
jest.mock("nhs-mesh-client");
handShake.mockResolvedValue({ status: "Handshake successful, status 200" });
readMessage.mockResolvedValue({ data: { nhs_num: "123", name: "bolo" } });

describe("processRecords", () => {
  let mockSQSClient;
  const mockPerformHandshake = jest.fn();
  const mockDispatchMessage = jest.fn();
  const mockLoadConfig = jest.fn();

  beforeEach(() => {
    jest.restoreAllMocks();
    mockSQSClient = mockClient(new SQSClient({}));
  });

  afterEach(() => {
    mockSQSClient.reset();
  });

  const records = [
    {
      receiptHandle: 'receiptHandle1',
      body: '{"grail_fhir_result_id":"id-1","ack_code":"ok"}'
    },
    {
      receiptHandle: 'receiptHandle2',
      body: '{"grail_fhir_result_id":"id-2","ack_code":"ok"}'

    },
    {
      receiptHandle: 'receiptHandle3',
      body: '{"grail_fhir_result_id":"id-3","ack_code":"ok"}'

    },
    {
      receiptHandle: 'receiptHandle4',
      body: '{"grail_fhir_result_id":"id-4","ack_code":"fatal-error"}'

    },
    {
      receiptHandle: 'receiptHandle5',
      body: '{"grail_fhir_result_id":"id-5","ack_code":"fatal-error"}'
    }
  ];

  test("Successfully process records", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorSpy = jest.spyOn(global.console, "error");
    const smClient = mockClient(SecretsManagerClient);

    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: "my_secret_value" }),
    });

    mockPerformHandshake.mockResolvedValue({ status: 200 });

    // Mock dispatchMessage to return a message with status 202
    mockDispatchMessage.mockResolvedValue({
      status: 202,
      data: { message_id: "123456789" },
    });

    mockLoadConfig.mockResolvedValue({
      url: "example.com",
      senderMailboxID: "sender@example.com",
      senderMailboxPassword: "password",
      sharedKey: "sharedKey",
      senderAgent: "senderAgent",
      receiverMailboxID: "receiver@example.com",
    });

    await processRecords(records, mockPerformHandshake, mockDispatchMessage, mockLoadConfig, mockSQSClient);

    expect(logSpy).toHaveBeenCalledWith('Processing acknowledgment for result id id-1 with ack code ok');
    expect(logSpy).toHaveBeenCalledWith('Processing acknowledgment for result id id-2 with ack code ok');
    expect(logSpy).toHaveBeenCalledWith('Processing acknowledgment for result id id-3 with ack code ok');
    expect(logSpy).toHaveBeenCalledWith('Processing acknowledgment for result id id-4 with ack code fatal-error');
    expect(logSpy).toHaveBeenCalledWith('Processing acknowledgment for result id id-5 with ack code fatal-error');
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 5 - Records successfully processed/sent: 5 - Records failed to send: 0');
    expect(errorSpy).toHaveBeenCalledTimes(0);
  });

  test("Should handle errors when processing records", async () => {
    mockSQSClient.on(DeleteMessageCommand).rejects(new Error('Failed to delete message'));

    const logSpy = jest.spyOn(global.console, "log");
    const errorSpy = jest.spyOn(global.console, "error");
    const smClient = mockClient(SecretsManagerClient);

    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: "my_secret_value" }),
    });

    mockPerformHandshake.mockResolvedValue({ status: 200 });

    // Mock dispatchMessage to return a message with status 202
    mockDispatchMessage.mockResolvedValue({
      status: 202,
      data: { message_id: "123456789" },
    });

    mockLoadConfig.mockResolvedValue({
      url: "example.com",
      senderMailboxID: "sender@example.com",
      senderMailboxPassword: "password",
      sharedKey: "sharedKey",
      senderAgent: "senderAgent",
      receiverMailboxID: "receiver@example.com",
    });

    await processRecords(records, mockPerformHandshake, mockDispatchMessage, mockLoadConfig, mockSQSClient);

    expect(logSpy).toHaveBeenCalledWith("Total records in the batch: 5 - Records successfully processed/sent: 0 - Records failed to send: 5")
    expect(errorSpy).toHaveBeenCalledWith("Error: Not able to process record due to error Failed to delete message");
    expect(errorSpy).toHaveBeenCalledWith("Error: Failed to delete message: result id id-1 with ack code ok");
    expect(errorSpy).toHaveBeenCalledWith("Error: Failed to delete message: result id id-2 with ack code ok");
    expect(errorSpy).toHaveBeenCalledWith("Error: Failed to delete message: result id id-3 with ack code ok");
    expect(errorSpy).toHaveBeenCalledWith("Error: Failed to delete message: result id id-4 with ack code fatal-error");
    expect(errorSpy).toHaveBeenCalledWith("Error: Failed to delete message: result id id-5 with ack code fatal-error");
  });
});

describe("getSecret", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successfully retrieve secret from secret manager", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const smClient = mockClient(SecretsManagerClient);

    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: "my_secret_value" }),
    });
    const sm = new SecretsManagerClient({});
    const result = await sm.send(
      new GetSecretValueCommand({ SecretId: "MESH_SENDER_CERT" })
    );
    expect(result.SecretString).toBe('{"my_secret_key":"my_secret_value"}');

    const smClient2 = mockClient(SecretsManagerClient);
    smClient2.resolves({});
    const response = await getSecret("MESH_SENDER_CERT", smClient2);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Retrieved value successfully MESH_SENDER_CERT`
    );
  });
  test("Failure when retrieving secret", async () => {
    const logSpy = jest.spyOn(global.console, "error");
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
      "Error: Failed to get secret, Error: Failed to retrieve secret to S3"
    );
  });
});

describe("readSecret", () => {
  test("should return secret string when fetched successfully", async () => {
    // Mock data
    const fetchSecretMock = jest
      .fn()
      .mockResolvedValue("VGhpcyBpcyBhIHNlY3JldCBzdHJpbmc=");
    const secretName = "test-secret";
    const clientMock = {}; // Mock Secrets Manager client

    // Call the function being tested
    const result = await readSecret(fetchSecretMock, secretName, clientMock);

    // Assertions
    expect(result).toEqual("This is a secret string");
    expect(fetchSecretMock).toHaveBeenCalledWith(secretName, clientMock);
  });

  test("should throw error when fetching secret fails", async () => {
    // Mock data
    const fetchSecretMock = jest
      .fn()
      .mockRejectedValue(new Error("Failed to fetch secret"));
    const secretName = "test-secret";
    const clientMock = {}; // Mock Secrets Manager client

    // Call the function being tested and assert the error
    await expect(
      readSecret(fetchSecretMock, secretName, clientMock)
    ).rejects.toThrowError("Failed to fetch secret");
    expect(fetchSecretMock).toHaveBeenCalledWith(secretName, clientMock);
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

    const mockRecord = { messageId: '12345', receiptHandle: '12345'};
    const mockQueue = 'https://sqs.eu-west-2.amazonaws.com/123456/mockQueue.fifo';


    await deleteMessageInQueue("12345","ok",mockRecord,mockQueue,mockSQSClient);

    // Expects
    expect(logSpy).toHaveBeenCalledWith(`Deleted message for result id 12345 with ack code ok from the test result ack queue.`);
    expect(mockSQSClient.commandCalls(DeleteMessageCommand).length).toEqual(1);
  });

  test('Message unsuccessfully deleted', async () => {
    let logSpy = jest.spyOn(global.console, "error");
    mockSQSClient.on(DeleteMessageCommand).rejects(new Error('Failed to send message'));
    const mockMessage = {
      grail_fhir_result_id:"12345",
      ack_code:"ok"
    };
    const mockRecord = { messageId: '12345', receiptHandle: '12345'};
    const mockQueue = 'https://sqs.eu-west-2.amazonaws.com/123456/mockQueue.fifo';
    let errorCaught = false;

    try {
      await deleteMessageInQueue("12345","ok",mockRecord,mockQueue,mockSQSClient);
    } catch (error) {
      expect(logSpy).toHaveBeenCalledWith(`Error: Failed to delete message: result id 12345 with ack code ok`);
      errorCaught = true;
    }
    expect(errorCaught).toBe(true);
  });
});

describe("sendMessageToMesh", () => {
  const mockConfig = {
    url: "example.com",
    senderMailboxID: "sender@example.com",
    senderMailboxPassword: "password",
    sharedKey: "sharedKey",
    senderAgent: "senderAgent",
    receiverMailboxID: "receiver@example.com",
  };

  const mockMsg = [{ name: "John" }, { name: "Doe" }];
  const mockFilename = "test.json";

  // Mock performHandshake and dispatchMessage
  const mockPerformHandshake = jest.fn();
  const mockDispatchMessage = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should log success message and return message_id if message creation succeeds", async () => {
    // Mock performHandshake to return a health check with status 200
    mockPerformHandshake.mockResolvedValue({ status: 200 });

    // Mock dispatchMessage to return a message with status 202
    mockDispatchMessage.mockResolvedValue({
      status: 202,
      data: { message_id: "123456789" },
    });

    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Call the function
    const messageStatus = await sendMessageToMesh(
      mockConfig,
      mockMsg,
      mockFilename,
      mockPerformHandshake,
      mockDispatchMessage
    );

    // Expect console.log to have been called with the success message
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining("Successfully sent")
    );

    // Expect the function to return the message_id
    expect(messageStatus).toBe(202);

    // Restore the console.log function
    consoleLogSpy.mockRestore();
  });

  test("should throw error when health check fails", async () => {
    // Mock performHandshake to return health check status other than 200
    mockPerformHandshake.mockResolvedValue({ status: 500 });

    // Spy on console.log
    const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

    // Call the function and expect it to throw an error
    await expect(
      sendMessageToMesh(
        mockConfig,
        mockMsg,
        mockFilename,
        mockPerformHandshake,
        mockDispatchMessage
      )
    ).rejects.toThrowError("Health Check Failed");

    // Assertions
    expect(mockPerformHandshake).toHaveBeenCalledTimes(1);
    expect(mockDispatchMessage).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Sending message to N-RDS Mailbox`
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      `Message to be sent: [{\"name\":\"John\"},{\"name\":\"Doe\"}]`
    );
  });

  test("should throw an error if create message fails", async () => {
    // Mock performHandshake to return a health check with status 200
    mockPerformHandshake.mockResolvedValue({ status: 200 });

    // Mock dispatchMessage to return a message with status 400
    const createMessageError = new Error("Create Message Failed");
    createMessageError.status = 400;
    mockDispatchMessage.mockResolvedValue({ status: 400, data: "test-data" });

    // Call the function and expect it to throw an error
    await expect(
      sendMessageToMesh(
        mockConfig,
        mockMsg,
        mockFilename,
        mockPerformHandshake,
        mockDispatchMessage
      )
    ).rejects.toThrow(
      `Create Message Failed for ${mockFilename}: ${createMessageError.status}`
    );
  });
});

describe("buildMessage", () => {
  const positiveAckMessage = {
    resourceType: "Bundle",
    id: "ff09cccc-2c9b-4238-91d2-66fa6ee845d3",
    type: "message",
    entry:  [
        {
            fullUrl: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-MessageHeader",
            resource: {
                resourceType: "MessageHeader",
                eventCoding: {
                    system: "https://fhir.nhs.uk/CodeSystem/message-event",
                    code: "notification",
                    display: "Event Notification"
                },
                destination:  [
                    {
                        name: "GRAIL BIO UK LTD",
                        endpoint: "8KG14OT001"
                    }
                ],
                source: {
                    endpoint: "X26OT268"
                },
                response: {
                    identifier: "b4409d7c-b613-477c-b623-87e60406c2f0",
                    code: "ok"
                }
            }
        }
    ]
  }

  const negativeAckMessage = {
    resourceType: "Bundle",
    id: "6e7b1dbb-77d2-4ddd-ae0d-e4862a306c1d",
    type: "message",
    entry:  [
        {
            fullUrl: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-MessageHeader",
            resource: {
                resourceType: "MessageHeader",
                eventCoding: {
                    system: "https://fhir.nhs.uk/CodeSystem/message-event",
                    code: "notification",
                    display: "Event Notification"
                },
                destination:  [
                    {
                        name: "GRAIL BIO UK LTD",
                        endpoint: "8KG14OT001"
                    }
                ],
                source: {
                    endpoint: "X26OT268"
                },
                response: {
                    identifier: "f50c58ea-543f-4530-99fa-ceb7b9dbbed5",
                    code: "fatal-error"
                }
            }
        }
    ]
  }

  test('should return a positive ack message', async() => {
    const message = await buildMessage("X26OT268","8KG14OT001","b4409d7c-b613-477c-b623-87e60406c2f0","ok","ff09cccc-2c9b-4238-91d2-66fa6ee845d3");
    expect(message).toEqual(positiveAckMessage);
  });

  test('should return a negative ack message', async () => {
    const message = await buildMessage("X26OT268","8KG14OT001","f50c58ea-543f-4530-99fa-ceb7b9dbbed5","fatal-error","6e7b1dbb-77d2-4ddd-ae0d-e4862a306c1d");
    expect(message).toEqual(negativeAckMessage);
  });
});
