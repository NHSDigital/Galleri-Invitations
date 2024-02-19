import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { handler, getSecret, getJSONFromS3, pushJsonToS3, deleteObjectFromS3, sendUncompressed, readMsg, readSecret } from "../../sendGTMSInvitationBatchLambda/sendGTMSInvitationBatchLambda";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { handShake, loadConfig, readMessage } from "nhs-mesh-client";

jest.mock("nhs-mesh-client");
handShake.mockResolvedValue({ status: "Handshake successful, status 200" });
readMessage.mockResolvedValue({ data: { nhs_num: "123", name: "bolo" } })

describe("Integration Tests", () => {

  describe("getSecret", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    test("Successfully retrieve secret from secret manager", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const smClient = mockClient(SecretsManagerClient);

      smClient.on(GetSecretValueCommand).resolves({
        SecretString: JSON.stringify({ my_secret_key: 'my_secret_value' }),
      });
      const sm = new SecretsManagerClient({});
      const result = await sm.send(new GetSecretValueCommand({ "SecretId": "MESH_SENDER_CERT" }));
      expect(result.SecretString).toBe('{"my_secret_key":"my_secret_value"}');

      const smClient2 = mockClient(SecretsManagerClient);
      smClient2.resolves({});
      const response = await getSecret("MESH_SENDER_CERT", smClient2);
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(`Retrieved value successfully MESH_SENDER_CERT`);
    })
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
      expect(logSpy).toHaveBeenCalledWith('Failed: Error: Failed to retrieve secret to S3');
    });
  })

  describe("readMsg", () => {
    const mockConfig = {
      url: "example",
      mailboxID: "example",
      mailboxPassword: "example",
      sharedKey: "example",
      agent: "example"
    };
    beforeEach(() => {
      jest.clearAllMocks();
    })
    test('test readMsg', async () => {
      const msgID = '123ID';
      const logSpy = jest.spyOn(global.console, "log");
      //pass in mocked readMessage function from globally mocked nhs-mesh-client module
      const result = await readMsg(mockConfig, msgID, readMessage);
      console.log(result.data);
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(result.data).toStrictEqual({ nhs_num: "123", name: "bolo" });
    });

    test('test readMsg failure', async () => {
      readMessage.mockRejectedValue("ERROR: Request 'readMessage' completed but responded with incorrect status");
      const msgID = '123ID';
      const logSpy = jest.spyOn(global.console, "log");
      try {
        const result = await readMsg(mockConfig, msgID, readMessage);
        console.log(result);
      } catch (err) {
        console.log(err);
        expect(err).toBe("ERROR: Request 'readMessage' completed but responded with incorrect status");
        expect(logSpy).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith(`result: undefined`);
      }
    })
  })

  describe('getJSONFromS3', () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return JSON string when object is retrieved successfully', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const key = 'test-key';
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

    test('should throw error when object retrieval fails', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const key = 'test-key';
      const client = new S3Client({});
      const error = new Error('Failed to retrieve object');
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      // Act & Assert
      await expect(getJSONFromS3(bucketName, key, s3Client)).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });
  });

  describe('pushJsonToS3', () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return status code 200 when JSON is successfully pushed to S3', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const key = 'test-key';
      const jsonArr = [{ name: 'John' }, { name: 'Doe' }];
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

    test('should throw error when pushing JSON to S3 fails', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const key = 'test-key';
      const jsonArr = [{ name: 'John' }, { name: 'Doe' }];
      const client = new S3Client({});
      const error = new Error('Failed to push JSON to S3');
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      // Act & Assert
      await expect(pushJsonToS3(s3Client, bucketName, key, jsonArr)).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });
  });

  describe('deleteObjectFromS3', () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return status code 204 when object is successfully deleted from S3', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const objectKey = 'test-key';
      const client = new S3Client({});
      const response = { $metadata: { httpStatusCode: 204 } };
      const s3SendMock = jest.fn().mockResolvedValue(response);
      const s3Client = { send: s3SendMock };

      // Act
      const result = await deleteObjectFromS3(bucketName, objectKey, s3Client);

      // Assert
      expect(result).toBe(204);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    test('should throw error when deleting object from S3 fails', async () => {
      // Arrange
      const bucketName = 'test-bucket';
      const objectKey = 'test-key';
      const client = new S3Client({});
      const error = new Error('Failed to delete object from S3');
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      // Act & Assert
      await expect(deleteObjectFromS3(bucketName, objectKey, s3Client)).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe('sendUncompressed', () => {
    const mockConfig = {
      url: 'example.com',
      senderMailboxID: 'sender@example.com',
      senderMailboxPassword: 'password',
      sharedKey: 'sharedKey',
      senderAgent: 'senderAgent',
      receiverMailboxID: 'receiver@example.com'
    };

    const mockMsg = { /* mock message */ };
    const mockFilename = 'test.json';

    // Mock performHandshake and dispatchMessage
    const mockPerformHandshake = jest.fn();
    const mockDispatchMessage = jest.fn();

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('should log an error and exit process if health check fails', async () => {
      // Mock performHandshake to return a health check with status !== 200
      mockPerformHandshake.mockResolvedValue({ status: 500 });

      // Mock process.exit
      const originalExit = process.exit;
      process.exit = jest.fn();

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Call the function
      await sendUncompressed(mockConfig, mockMsg, mockFilename, mockPerformHandshake, mockDispatchMessage);

      // Expect console.error to have been called with the correct message
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Health Check Failed'));

      // Restore process.exit
      process.exit = originalExit;


      // Restore the console.error function
      consoleErrorSpy.mockRestore();
    });

    test('should log an error and exit process if message creation fails', async () => {
      // Mock performHandshake to return a health check with status 200
      mockPerformHandshake.mockResolvedValue({ status: 200 });

      // Mock dispatchMessage to return a message with status !== 202
      mockDispatchMessage.mockResolvedValue({ status: 500 });

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Call the function
      await sendUncompressed(mockConfig, mockMsg, mockFilename, mockPerformHandshake, mockDispatchMessage);

      // Expect console.error to have been called with the correct message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Create Message Failed'));

      // Restore the console.error function
      consoleErrorSpy.mockRestore();
    });

    test('should log success message and return message_id if message creation succeeds', async () => {
      // Mock performHandshake to return a health check with status 200
      mockPerformHandshake.mockResolvedValue({ status: 200 });

      // Mock dispatchMessage to return a message with status 202
      mockDispatchMessage.mockResolvedValue({ status: 202, data: { message_id: '123456789' } });

      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Call the function
      const messageId = await sendUncompressed(mockConfig, mockMsg, mockFilename, mockPerformHandshake, mockDispatchMessage);

      // Expect console.log to have been called with the success message
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully sent'));

      // Expect the function to return the message_id
      expect(messageId).toBe('123456789');

      // Restore the console.log function
      consoleLogSpy.mockRestore();
    });

    test('should exit process if an error occurs', async () => {
      // Arrange
      mockPerformHandshake.mockRejectedValue(new Error('Network error')); // Mock error during handshake

      // Spy on console.error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock process.exit
      const originalExit = process.exit;
      process.exit = jest.fn();

      // Act
      await sendUncompressed(mockConfig, mockMsg, mockFilename, mockPerformHandshake, mockDispatchMessage);

      // Assert
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith("An error occurred:", "Network error");

      // Restore process.exit
      process.exit = originalExit;
    });
  });
});
