import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({ region: "eu-west-2" });
const ssmClient = new SSMClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  const parameterStoreValue = getParameterStore();
  if (parameterStoreValue) {
    const tableParams = {
      TableName: `${ENVIRONMENT}-Population`,
      KeyConditionExpression: "participantId = :participantId",
      ExpressionAttributeValues: {
        ":participantId": { S: event.participantId },
      },
    };

    try {
      const { Items } = await dynamoDBClient.send(
        new QueryCommand(tableParams)
      );

      for (const record of Items) {
        const messageBody = {
          participantId: record.participantId,
          nhsNumber: record.nhsNumber,
          episodeEvent: "Invited",
        };
        const messageParams = {
          QueueUrl: process.env.SQS_QUEUE_URL,
          MessageBody: JSON.stringify(messageBody),
        };

        await sqsClient.send(new SendMessageCommand(messageParams));
        console.log("Sent item to SQS queue:", record);
      }
      console.log("Retrieved items:", Items);
      return { statusCode: 200, body: "Items sent to SQS queue successfully" };
    } catch (error) {
      console.error("Error querying items:", error);
      throw error;
    }
  } else {
    console.log(
      "Parameter value was not true so exiting processEventNotificationLambda"
    );
  }
};

// Functions
export async function getParameterStore() {
  const parameterStoreParams = {
    Name: "",
  };
  try {
    const { Parameter } = await ssmClient.send(
      new GetParameterCommand(parameterStoreParams)
    );
    console.log("Parameter value:", Parameter.Value);
    return Parameter.Value;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
