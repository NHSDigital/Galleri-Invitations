import { handler } from "../../processEventNotificationLambda/processEventNotificationLambda";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

process.env.ENVIRONMENT = "test";
process.env.SQS_QUEUE_URL = "mock-sqs-queue-url";

describe("Lambda handler", () => {
  afterEach(() => {
    mockClient(DynamoDBClient).reset();
    mockClient(SQSClient).reset();
    mockClient(SSMClient).reset();
  });

  it('should send items to SQS queue successfully when parameterStoreValue is "True"', async () => {
    const mockEvent = {
      Records: [
        {
          dynamodb: {
            NewImage: {
              Episode_Event: { S: "YourEpisodeEvent" },
              Participant_Id: { S: "YourParticipantId" },
            },
          },
        },
      ],
    };

    mockClient(SSMClient)
      .on(GetParameterCommand)
      .resolves({
        Parameter: { Value: "True" },
      });

    const mockItem = {
      participantId: "mockParticipantId",
      nhsNumber: "mockNhsNumber",
    };
    mockClient(DynamoDBClient)
      .on(QueryCommand)
      .resolves({
        Items: [mockItem],
      });

    mockClient(SQSClient).on(SendMessageCommand).resolves({});

    const result = await handler(mockEvent);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe("Items sent to SQS queue successfully");
  });

  it('should log error and throw when parameterStoreValue is not "True"', async () => {
    const mockEvent = {
      Records: [
        {
          dynamodb: {
            NewImage: {
              Episode_Event: { S: "YourEpisodeEvent" },
              Participant_Id: { S: "YourParticipantId" },
            },
          },
        },
      ],
    };

    mockClient(SSMClient)
      .on(GetParameterCommand)
      .resolves({
        Parameter: { Value: "False" },
      });
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    await expect(handler(mockEvent)).rejects.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
