import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({ region: "eu-west-2" });
const ssmClient = new SSMClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event, context) => {
  try {
    console.log("No. of episodes inserted: ", event.Records.length);

    const parameterStoreValue = await getParameterStore(
      event.Records[0]?.dynamodb?.NewImage?.Episode_Event?.S
    );
    let episodeEvent;

    if (parameterStoreValue === "True") {
      for (const record of event.Records) {
        const participantId = record?.dynamodb?.NewImage?.Participant_Id?.S;

        if (!participantId) {
          console.log("ParticipantId not found in record:", record);
          continue;
        }

        episodeEvent = record.dynamodb.NewImage.Episode_Event.S;

        const item = await getParticipantFromDB(participantId);

        if (item) {
          await sendToSQS(item, episodeEvent);
          console.log("Sent item to SQS queue:", item);
        } else {
          console.log("No item found for participantId:", participantId);
        }
      }

      return { statusCode: 200, body: "Items sent to SQS queue successfully" };
    } else {
      console.log(
        "Parameter value was not true so exiting processEventNotificationLambda"
      );
      throw new Error("Parameter value was not true");
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

export async function getParameterStore(episodeEvent) {
  try {
    const parameterName = `${episodeEvent
      ?.replace(/\s+/g, "-")
      ?.toLowerCase()}-notify`;
    const { Parameter } = await ssmClient.send(
      new GetParameterCommand({ Name: parameterName })
    );
    console.log("Parameter value:", Parameter.Value);
    return Parameter.Value;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export async function getParticipantFromDB(participantId) {
  try {
    const {
      Items: [item],
    } = await dynamoDBClient.send(
      new QueryCommand({
        TableName: `${ENVIRONMENT}-Population`,
        ExpressionAttributeValues: {
          ":id": { S: participantId },
        },
        KeyConditionExpression: "PersonId = :id",
        Limit: 1,
        ProjectionExpression: "PersonId, participantId, nhsNumber",
      })
    );
    return item;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export async function sendToSQS(item, episodeEvent) {
  try {
    const messageBody = {
      participantId: item.participantId,
      nhsNumber: item.nhsNumber,
      episodeEvent,
    };

    const messageParams = {
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: "notInvitedParticipant",
    };

    await sqsClient.send(new SendMessageCommand(messageParams));
    console.log("Sent item to SQS queue:", JSON.stringify(messageBody));
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
