// Import the Lambda handler and helper functions
import {
  handler,
  processSnsMessage,
  sendMessageToQueue,
} from "../../sendTestResultOkAckQueueLambda";
import { mockClient } from "aws-sdk-client-mock";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

describe("All Tests", () => {
  describe("handler", () => {
    let mockProcessSnsMessage;
    let mockSendMessageToQueue;

    beforeEach(() => {
      const responseBody = '{"name": "John"}';
      mockProcessSnsMessage = jest.fn().mockResolvedValue(responseBody);
      mockSendMessageToQueue = jest.fn();
    });

    test("should handle SNS message and send to queue", async () => {
      let logSpy = jest.spyOn(global.console, "log");
      // Mock event object
      const mockEvent = {
        Records: [
          {
            Sns: {
              TopicArn: "arn:aws:sns:eu-west-1:123456789012:your-topic-name",
              Timestamp: "2024-05-06T12:00:00Z",
            },
          },
        ],
      };

      process.env.TEST_RESULT_ACK_QUEUE_URL = "mock-queue-url";
      const mockSqsClient = new SQSClient({});
      jest.spyOn(mockSqsClient, "constructor");

      await handler(mockEvent);

      expect(logSpy).toHaveBeenCalledWith(
        "Triggered by message published on SNS Topic: your-topic-name at 2024-05-06T12:00:00Z"
      );
    });

    test("should handle errors gracefully", async () => {
      const errorLogSpy = jest.spyOn(global.console, "error");
      const mockEvent = {
        Records: [
          {
            Sns: {
              TopicArn: "arn:aws:sns:eu-west-1:123456789012:your-topic-name",
              Timestamp: "2024-05-06T12:00:00Z",
            },
          },
        ],
      };

      // Mock error
      const mockError = new Error("Failed to process message");
      mockProcessSnsMessage.mockRejectedValueOnce(mockError);

      await handler(mockEvent);
      expect(errorLogSpy).toHaveBeenCalledWith(
        "Lambda process was not successful in this instance"
      );
      expect(errorLogSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe("processSnsMessage", () => {
    let mockSendMsgToSqs;
    let mockSqsClient;

    beforeEach(() => {
      mockSendMsgToSqs = jest.fn();
      mockSqsClient = {};
    });

    test("should process and send message to SQS successfully", async () => {
      let logSpy = jest.spyOn(global.console, "log");
      const mockEvent = {
        Records: [
          {
            Sns: {
              MessageId: "mock-message-id",
              Message: '{"grail_FHIR_result_id": "123"}',
            },
          },
        ],
      };
      await processSnsMessage(
        mockEvent,
        mockSendMsgToSqs,
        "mock-queue-url",
        mockSqsClient,
        "QUEUE_NAME"
      );

      expect(mockSendMsgToSqs).toHaveBeenCalledWith(
        { grail_fhir_result_id: "123", ack_code: "ok" },
        "mock-queue-url",
        {},
        "mock-message-id"
      );
      expect(logSpy).toHaveBeenCalledWith(
        "Successfully sent the message to SQS Queue: QUEUE_NAME"
      );
    });

    test("should throw error for missing or invalid fields in SNS message", async () => {
      // Mock event with missing required fields
      const invalidEvent = {
        Records: [
          {
            Sns: {
              MessageId: "mock-message-id",
              Message: "{}",
            },
          },
        ],
      };
      await expect(
        processSnsMessage(
          invalidEvent,
          mockSendMsgToSqs,
          "mock-queue-url",
          mockSqsClient,
          "QUEUE_NAME"
        )
      ).rejects.toThrowError("Missing required fields in SNS message");
    });

    test("should throw error when sending message to SQS fails", async () => {
      // Mock error when sending message to SQS
      mockSendMsgToSqs.mockRejectedValueOnce(
        new Error("Failed to send message to SQS queue: QUEUE_NAME")
      );
      const mockEvent = {
        Records: [
          {
            Sns: {
              MessageId: "mock-message-id",
              Message: '{"grail_FHIR_result_id": "123"}',
            },
          },
        ],
      };

      await expect(
        processSnsMessage(
          mockEvent,
          mockSendMsgToSqs,
          "mock-queue-url",
          mockSqsClient,
          "QUEUE_NAME"
        )
      ).rejects.toThrowError("Failed to send message to SQS queue: QUEUE_NAME");
    });
  });

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
      const mockQueueName = "QueueName";
      const mockQueue =
        "https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo";

      await sendMessageToQueue(
        mockMessage,
        mockQueue,
        mockSQSClient,
        mockQueueName
      );

      expect(logSpy).toHaveBeenCalledWith(
        `Message sent to SQS queue for SNS Message_ID:QueueName.`
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
      const mockQueueName = "QueueName";
      const mockQueue =
        "https://sqs.eu-west-2.amazonaws.com/123456/dev-notifyEnrichedMessageQueue.fifo";

      try {
        await sendMessageToQueue(
          mockMessage,
          mockQueue,
          mockSQSClient,
          mockQueueName
        );
      } catch (error) {
        expect(logSpy).toHaveBeenCalledWith(
          "Error: Failed to send message to SQS queue"
        );
      }
    });
  });
});
