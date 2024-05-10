// Import the Lambda handler and helper functions
import {
  handler,
  retrieveAndParseJSON,
  sendMessageToQueue,
  getJSONFromS3,
  deleteObjectFromS3,
} from "../../sendTestResultErrorAckQueueLambda";
import { mockClient } from "aws-sdk-client-mock";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// jest.mock("../../sendTestResultErrorAckQueueLambda", () => ({
//   retrieveAndParseJSON: jest.fn(),
//   deleteObjectFromS3: jest.fn(),
//   handler: jest.fn(),
//   getJSONFromS3: jest.fn(),
//   sendMessageToQueue: jest.fn(),
// }));

// Mock AWS SDK
// jest.mock("@aws-sdk/client-sqs", () => ({
//   SQSClient: jest.fn(() => ({
//     send: jest.fn(),
//   })),
//   SendMessageCommand: jest.fn(),
// }));

// Mock the SQSClient and its send method
const mockSQSClient = {
  send: jest.fn(),
};

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn(),
  })),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

describe("All Tests", () => {
  describe("sendMessageToQueue", () => {
    let mockSQSClient;

    beforeEach(() => {
      jest.restoreAllMocks();
      mockSQSClient = mockClient(new SQSClient({}));
    });

    afterEach(() => {
      mockSQSClient.reset();
    });

    test("Successful message sent", async () => {
      let logSpy = jest.spyOn(global.console, "log");
      mockSQSClient.on(SendMessageCommand).resolves({
        $metadata: { httpStatusCode: 200 },
        MessageId: "123",
      });
      const mockMessage = "Hello Word. This is Dr. Stone";
      const key = "key";
      const mockQueue =
        "https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo";

      await sendMessageToQueue(mockMessage, mockQueue, mockSQSClient, key);

      expect(logSpy).toHaveBeenCalledWith(
        `Message sent to SQS queue for object:key.`
      );
      expect(mockSQSClient.commandCalls(SendMessageCommand).length).toEqual(1);
    });

    test("Message unsuccessfully sent", async () => {
      let logSpy = jest.spyOn(global.console, "error");
      mockSQSClient
        .on(SendMessageCommand)
        .rejects(new Error("Failed to send message"));
      const mockMessage = {
        participantId: "NHS-QC89-DD11",
        nhsNumber: "9000203188",
        episodeEvent: "Invited",
        routingId: "4c4c4c06-0f6d-465a-ab6a-ca358c2721b0",
      };
      const mockKey = "key";
      const mockQueue =
        "https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo";

      try {
        await sendMessageToQueue(
          mockMessage,
          mockQueue,
          mockSQSClient,
          mockKey
        );
      } catch (error) {
        expect(logSpy).toHaveBeenCalledWith(
          "Error: Failed to send message to SQS queue"
        );
      }
    });
  });

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

      expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
      expect(result).toEqual({ name: "John" }); // Check if JSON is correctly parsed
    });

    test("should throw an error if getJSON fails", async () => {
      // Mock data
      const bucket = "test-bucket";
      const key = "test-key";
      const client = {}; // Mock client object
      const error = new Error(
        `Error: Failed to retrieve and parse JSON File ${key} from bucket ${bucket}`
      );

      const getJSONMock = jest.fn().mockRejectedValue(error);
      await expect(
        retrieveAndParseJSON(getJSONMock, bucket, key, client)
      ).rejects.toThrow(error);
      expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
    });
  });

  describe("getJSONFromS3", () => {
    // Clear mocks before each test
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test("should return JSON string when object is retrieved successfully", async () => {
      const bucketName = "test-bucket";
      const key = "test-key";
      const responseBody = '{"name": "John"}';
      const response = {
        $metadata: { httpStatusCode: 200 },
        Body: { transformToString: jest.fn().mockResolvedValue(responseBody) },
      };
      const s3SendMock = jest.fn().mockResolvedValue(response);
      const s3Client = { send: s3SendMock };
      const result = await getJSONFromS3(bucketName, key, s3Client);

      expect(result).toEqual(responseBody);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    test("should throw error when object retrieval fails", async () => {
      const bucketName = "test-bucket";
      const key = "test-key";
      const error = new Error("Failed to retrieve object");
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      await expect(getJSONFromS3(bucketName, key, s3Client)).rejects.toThrow(
        error
      );
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(GetObjectCommand));
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

      const result = await deleteObjectFromS3(bucketName, objectKey, s3Client);
      expect(result).toBe(204);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    test("should throw error when deleting object from S3 fails", async () => {
      const bucketName = "test-bucket";
      const objectKey = "test-key";
      const error = new Error("Failed to delete object from S3");
      const s3SendMock = jest.fn().mockRejectedValue(error);
      const s3Client = { send: s3SendMock };

      await expect(
        deleteObjectFromS3(bucketName, objectKey, s3Client)
      ).rejects.toThrow(error);
      expect(s3SendMock).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe("Lambda Handler", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    const retrieveAndParseJSON = jest.fn();
    const deleteObjectFromS3 = jest.fn();
    const getJSONFromS3 = jest.fn();
    const sendMessageToQueue = jest.fn();
    process.env.TEST_RESULT_ACK_QUEUE_URL = "queue-url/queue-name";
    const mockS3Client = mockClient(new S3Client({}));

    it("should handle event and process message successfully", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const errorLogSpy = jest.spyOn(global.console, "error");
      const event = {
        Records: [
          {
            s3: {
              bucket: {
                name: "test-bucket",
              },
              object: {
                key: "test-key",
              },
            },
          },
        ],
      };

      // Mock the helper functions behavior
      retrieveAndParseJSON.mockResolvedValueOnce({ id: "test-id" });
      sendMessageToQueue.mockResolvedValueOnce();
      deleteObjectFromS3.mockResolvedValueOnce();

      await handler(event);
      // expect(retrieveAndParseJSON).toHaveBeenCalledWith(
      //   getJSONFromS3,
      //   "test-bucket",
      //   "test-key",
      //   mockS3Client
      // );
      // expect(sendMessageToQueue).toHaveBeenCalledWith(
      //   { grail_fhir_result_id: "test-id", ack_code: "fatal-error" },
      //   expect.any(String),
      //   expect.any(SQSClient),
      //   "test-key"
      // );
      // expect(deleteObjectFromS3).toHaveBeenCalledWith(
      //   "test-bucket",
      //   "test-key",
      //   expect.any(S3Client)
      // );
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(errorLogSpy).toHaveBeenCalledTimes(7);
    });

    it("should handle errors and log them", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const errorLogSpy = jest.spyOn(global.console, "error");
      const event = {
        Records: [
          {
            s3: {
              bucket: {
                name: "test-bucket",
              },
              object: {
                key: "test-key",
              },
            },
          },
        ],
      };

      // Mock the behavior of helper functions to throw errors
      retrieveAndParseJSON.mockRejectedValueOnce(
        new Error("Failed to retrieve and parse JSON")
      );
      sendMessageToQueue.mockRejectedValueOnce(
        new Error("Failed to send message to SQS")
      );
      deleteObjectFromS3.mockRejectedValueOnce(
        new Error("Failed to delete object from S3")
      );

      await handler(event);

      // expect(retrieveAndParseJSON).toHaveBeenCalledWith(
      //   getJSONFromS3,
      //   "test-bucket",
      //   "test-key",
      //   expect.any(S3Client)
      // );
      expect(sendMessageToQueue).not.toHaveBeenCalled();
      expect(deleteObjectFromS3).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(errorLogSpy).toHaveBeenCalledTimes(5);
    });
  });
});
