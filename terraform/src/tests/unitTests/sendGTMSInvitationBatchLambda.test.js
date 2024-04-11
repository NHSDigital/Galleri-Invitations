import { mockClient } from "aws-sdk-client-mock";
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  retrieveAndParseJSON,
  sendMessageToMesh,
  handleSentMessageFile,
  getSecret,
  getJSONFromS3,
  pushJsonToS3,
  deleteObjectFromS3,
  sendUncompressed,
  readMsg,
  readSecret,
} from "../../sendGTMSInvitationBatchLambda/sendGTMSInvitationBatchLambda";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { handShake, readMessage } from "nhs-mesh-client";

jest.mock("nhs-mesh-client");
handShake.mockResolvedValue({ status: "Handshake successful, status 200" });
readMessage.mockResolvedValue({ data: { nhs_num: "123", name: "bolo" } });

describe("Integration Tests", () => {
  describe("retrieveAndParseJSON", () => {
    test("should retrieve and parse JSON from S3", async () => {
      // Mock data
      const bucket = "test-bucket";
      const key = "test-key";
      const client = {}; // Mock client object
      const responseBody = '{"name": "John"}';

      // Mock the getJSON function
      const getJSONMock = jest.fn().mockResolvedValue(responseBody);

      // Call the function being tested
      const result = await retrieveAndParseJSON(
        getJSONMock,
        bucket,
        key,
        client
      );

      // Assertions
      expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
      expect(result).toEqual({ name: "John" }); // Check if JSON is correctly parsed
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

  describe("sendMessageToMesh", () => {
    test("should send message to MESH and return pre-send message object length and sent message ID", async () => {
      // Mock data
      const sendFuncMock = jest.fn().mockResolvedValue(202);
      const KEY_PREFIX = "invitation_batch_";
      const timestamp = "2023-10-26T12:00:00.000Z";
      const CONFIG = {
        url: "https://msg.intspineservices.nhs.uk",
        sharedKey: "test_shared_key",
        sandbox: "false",
        senderCert: "test_sender_cert",
        senderKey: "test_sender_key",
        senderMailboxID: "test_sender_mailbox_id",
        senderMailboxPassword: "test_sender_mailbox_password",
        receiverCert: "test_receiver_cert",
        receiverKey: "test_receiver_key",
        receiverMailboxID: "test_receiver_mailbox_id",
      };
      const JSONMsgObj = [{ name: "John" }, { name: "Jane" }];

      // Call the function being tested
      const result = await sendMessageToMesh(
        sendFuncMock,
        KEY_PREFIX,
        timestamp,
        CONFIG,
        JSONMsgObj
      );

      // Assertions
      expect(sendFuncMock).toHaveBeenCalledWith(
        CONFIG,
        JSONMsgObj,
        "invitation_batch_2023-10-26T12:00:00.000Z.json",
        expect.any(Function),
        expect.any(Function)
      );
      expect(result).toEqual({ sentMsgStatus: 202 });
    });

    test("should throw error if sending message fails", async () => {
      // Mock send function to throw error
      const sendFuncMock = jest
        .fn()
        .mockRejectedValue(new Error("Failed to send message"));

      // Mock data
      const KEY_PREFIX = "invitation_batch_";
      const timestamp = "2023-10-26T12:00:00.000Z";
      const CONFIG = {
        url: "https://msg.intspineservices.nhs.uk",
        sharedKey: "test_shared_key",
        sandbox: "false",
        senderCert: "test_sender_cert",
        senderKey: "test_sender_key",
        senderMailboxID: "test_sender_mailbox_id",
        senderMailboxPassword: "test_sender_mailbox_password",
        receiverCert: "test_receiver_cert",
        receiverKey: "test_receiver_key",
        receiverMailboxID: "test_receiver_mailbox_id",
      };
      const JSONMsgObj = [{ name: "John" }, { name: "Jane" }];

      // Call the function being tested and expect it to throw error
      await expect(
        sendMessageToMesh(
          sendFuncMock,
          KEY_PREFIX,
          timestamp,
          CONFIG,
          JSONMsgObj
        )
      ).rejects.toThrow("Failed to send message");
    });
  });
  describe("handleSentMessageFile function", () => {
    // Mocks for dependencies
    const pushJsonFuncMock = jest.fn();
    const deleteObjectFuncMock = jest.fn();
    const KEY_PREFIX = "test_prefix";
    const timestamp = "2023-05-02T12:00:00Z";
    const JSONMsgObj = { message: "Test message" };
    const bucket = "test_bucket";
    const key = "test_key";
    const clientMock = jest.fn();
    beforeEach(() => {
      pushJsonFuncMock.mockClear();
      deleteObjectFuncMock.mockClear();
      clientMock.mockClear();
    });

    test("should push JSON object to S3 and delete original object if sentMsgStatus is 202", async () => {
      // Mock pushJsonFunc to return 200 status code
      pushJsonFuncMock.mockReturnValueOnce(200);
      // Mock deleteObjectFunc
      deleteObjectFuncMock.mockReturnValueOnce(200);

      // Call the function
      await handleSentMessageFile(
        pushJsonFuncMock,
        deleteObjectFuncMock,
        KEY_PREFIX,
        timestamp,
        JSONMsgObj,
        202,
        bucket,
        key,
        clientMock
      );

      // Assertions
      expect(pushJsonFuncMock).toHaveBeenCalledWith(
        clientMock,
        expect.any(String),
        expect.any(String),
        JSONMsgObj
      );
      expect(deleteObjectFuncMock).toHaveBeenCalledWith(
        bucket,
        key,
        clientMock
      );
    });

    test("should not push JSON object to S3 and delete original object if sentMsgStatus is not 202", async () => {
      // Call the function with sentMsgStatus other than 202
      await handleSentMessageFile(
        pushJsonFuncMock,
        deleteObjectFuncMock,
        KEY_PREFIX,
        timestamp,
        JSONMsgObj,
        200, // Assume sentMsgStatus is not 202
        bucket,
        key,
        clientMock
      );

      // Expect pushJsonFunc and deleteObjectFunc not to be called
      expect(pushJsonFuncMock).not.toHaveBeenCalled();
      expect(deleteObjectFuncMock).not.toHaveBeenCalled();
    });

    test("should throw error if pushJsonFunc fails", async () => {
      // Mock pushJsonFunc to throw error
      pushJsonFuncMock.mockImplementationOnce(() => {
        throw new Error("Failed to push JSON to S3");
      });

      // Call the function and expect it to throw error
      await expect(
        handleSentMessageFile(
          pushJsonFuncMock,
          deleteObjectFuncMock,
          KEY_PREFIX,
          timestamp,
          JSONMsgObj,
          202,
          bucket,
          key,
          clientMock
        )
      ).rejects.toThrow("Failed to push JSON to S3");
    });

    test("should throw error if deleteObjectFunc fails", async () => {
      // Mock pushJsonFunc to return 200 status code
      pushJsonFuncMock.mockReturnValueOnce(200);
      // Mock deleteObjectFunc to throw error
      deleteObjectFuncMock.mockImplementationOnce(() => {
        throw new Error("Failed to delete object from S3");
      });

      // Call the function and expect it to throw error
      await expect(
        handleSentMessageFile(
          pushJsonFuncMock,
          deleteObjectFuncMock,
          KEY_PREFIX,
          timestamp,
          JSONMsgObj,
          202,
          bucket,
          key,
          clientMock
        )
      ).rejects.toThrow("Failed to delete object from S3");
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

  describe("readMsg", () => {
    const mockConfig = {
      url: "example",
      mailboxID: "example",
      mailboxPassword: "example",
      sharedKey: "example",
      agent: "example",
    };
    beforeEach(() => {
      jest.clearAllMocks();
    });
    test("test readMsg", async () => {
      const msgID = "123ID";
      const logSpy = jest.spyOn(global.console, "log");
      //pass in mocked readMessage function from globally mocked nhs-mesh-client module
      const result = await readMsg(mockConfig, msgID, readMessage);
      console.log(result.data);
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(result.data).toStrictEqual({ nhs_num: "123", name: "bolo" });
    });

    test("should throw an error if retrieveMessage function fails", async () => {
      const config = {
        url: "test-url",
        receiverMailboxID: "test-receiver-mailbox-id",
        receiverMailboxPassword: "test-receiver-mailbox-password",
        sharedKey: "test-shared-key",
        receiverAgent: "test-receiver-agent",
      };
      const msgID = "test-message-id";
      const mockResponse = { status: 200, data: "test-message-data" };
      const retrieveMessageMock = jest.fn().mockResolvedValue(mockResponse);
      // Arrange
      const errorMessage = "Failed to retrieve message";
      const error = new Error(errorMessage);
      retrieveMessageMock.mockRejectedValue(error);

      // Act & Assert
      await expect(readMsg(config, msgID, retrieveMessageMock)).rejects.toThrow(
        errorMessage
      );
    });
  });

  describe("getJSONFromS3", () => {
    // Clear mocks before each test
    beforeEach(() => {
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

  describe("pushJsonToS3", () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should return status code 200 when JSON is successfully pushed to S3", async () => {
      const bucketName = "test-bucket";
      const key = "test-key";
      const jsonArr = [{ name: "John" }, { name: "Doe" }];
      const client = new S3Client({});
      const response = { $metadata: { httpStatusCode: 200 } };
      const s3SendMock = jest.fn().mockResolvedValue(response);
      const s3Client = { send: s3SendMock };

      // Act
      const result = await pushJsonToS3(s3Client, bucketName, key, jsonArr);

      // Assert
      expect(result).toBe(200);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });

    test("should throw error when pushing JSON to S3 fails", async () => {
      const bucketName = "test-bucket";
      const key = "test-key";
      const jsonArr = [{ name: "John" }, { name: "Doe" }];
      const client = new S3Client({});
      const error = new Error("Failed to push JSON to S3");
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      // Act & Assert
      await expect(
        pushJsonToS3(s3Client, bucketName, key, jsonArr)
      ).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });
  });

  describe("deleteObjectFromS3", () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should return status code 204 when object is successfully deleted from S3", async () => {
      const bucketName = "test-bucket";
      const objectKey = "test-key";
      const response = { $metadata: { httpStatusCode: 204 } };
      const s3SendMock = jest.fn().mockResolvedValue(response);
      const s3Client = { send: s3SendMock };

      // Act
      const result = await deleteObjectFromS3(bucketName, objectKey, s3Client);

      // Assert
      expect(result).toBe(204);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    test("should throw error when deleting object from S3 fails", async () => {
      const bucketName = "test-bucket";
      const objectKey = "test-key";
      const error = new Error("Failed to delete object from S3");
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      // Act & Assert
      await expect(
        deleteObjectFromS3(bucketName, objectKey, s3Client)
      ).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe("sendUncompressed", () => {
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
      const messageStatus = await sendUncompressed(
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
        sendUncompressed(
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
        `Sending ${mockFilename} to GTMS Mailbox`
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
        sendUncompressed(
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
});
