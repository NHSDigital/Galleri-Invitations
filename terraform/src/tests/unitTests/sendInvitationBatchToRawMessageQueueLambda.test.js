import {
  processJSONObj,
  retrieveAndParseJSON,
  getJSONFromS3,
} from "../../sendInvitationBatchToRawMessageQueueLambda/sendInvitationBatchToRawMessageQueueLambda";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

describe("processJSONObj", () => {
  const sqsMock = mockClient(SQSClient);
  // Mock data
  const mockJSON = [
    { participantId: "p1", nhsNumber: "n1" },
    { participantId: "p2", nhsNumber: "n2" },
  ];

  afterEach(() => {
    sqsMock.reset();
  });

  test("should send messages for each record in JSONObj", async () => {
    // Mock the SendMessageCommand
    sqsMock.on(SendMessageCommand).resolves({ MessageId: "message-id" });

    // Call the function being tested
    await processJSONObj(mockJSON, new SQSClient({}));

    // Assertions
    const sendMessageCalls = sqsMock.calls(SendMessageCommand);
    expect(sendMessageCalls.length).toBe(mockJSON.length);

    mockJSON.forEach((record, index) => {
      const messageBody = {
        participantId: record.participantId,
        nhsNumber: record.nhsNumber,
        episodeEvent: "Invited",
      };

      expect(sendMessageCalls[index].args[0].input).toEqual({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(messageBody),
        MessageGroupId: "invitedParticipant",
      });
    });
  });

  test("should handle errors when sending messages", async () => {
    // Mock the SendMessageCommand
    sqsMock.on(SendMessageCommand).rejects(new Error("Send error"));
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Call the function being tested
    await processJSONObj(mockJSON, new SQSClient({}));

    // Assertion
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error:",
      new Error("Send error")
    );
  });
});

describe("retrieveAndParseJSON", () => {
  test("should retrieve and parse JSON from S3", async () => {
    // Mock data
    const bucket = "test-bucket";
    const key = "test-key";
    const client = {}; // Mock client object
    const responseBody =
      '{"participantId":"NHS-AB12-CD23","nhsNumber":"1234567891","dateOfBirth":"1950-01-01"}';

    // Mock the getJSON function
    const getJSONMock = jest.fn().mockResolvedValue(responseBody);

    // Call the function being tested
    const result = await retrieveAndParseJSON(getJSONMock, bucket, key, client);

    // Assertions
    expect(getJSONMock).toHaveBeenCalledWith(bucket, key, client);
    expect(result).toEqual({
      participantId: "NHS-AB12-CD23",
      nhsNumber: "1234567891",
      dateOfBirth: "1950-01-01",
    }); // Check if JSON is correctly parsed
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
