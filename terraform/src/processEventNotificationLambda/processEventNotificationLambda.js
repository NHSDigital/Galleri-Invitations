import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({ region: "eu-west-2" });
const ssmClient = new SSMClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

// Lambda handler function
export const handler = async (event, context) => {
  console.log("No. of episodes inserted: ", event.Records.length);

  const parameterStoreValue = await getParameterStore();

  if (parameterStoreValue === "true") {
    try {
      for (const record of event.Records) {
        const participantId = record.participantId;
        const tableParams = {
          TableName: `${ENVIRONMENT}-Population`,
          KeyConditionExpression: "participantId = :participantId",
          ExpressionAttributeValues: {
            ":participantId": { S: participantId },
          },
          ProjectionExpression: "participantId, nhsNumber, episodeEvent",
        };

        const { Items } = await dynamoDBClient.send(
          new QueryCommand(tableParams)
        );

        for (const item of Items) {
          const messageBody = {
            participantId: item.participantId,
            nhsNumber: item.nhsNumber,
            episodeEvent: item.episodeEvent,
          };

          const messageParams = {
            QueueUrl: process.env.SQS_QUEUE_URL,
            MessageBody: JSON.stringify(messageBody),
          };

          await sqsClient.send(new SendMessageCommand(messageParams));
          console.log("Sent item to SQS queue:", item);
        }

        console.log("Retrieved items:", Items);
      }

      return { statusCode: 200, body: "Items sent to SQS queue successfully" };
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  } else {
    console.log(
      "Parameter value was not true so exiting processEventNotificationLambda"
    );
  }
};

// Function to retrieve parameter value from Parameter Store
export async function getParameterStore() {
  const parameterStoreParams = {
    Name: "notify",
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
