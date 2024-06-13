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

/**
 * Retrieves parameter store value for given episode event
 *
 * @function getParameterStore
 * @async
 * @param {string} episodeEvent Episode event type.
 * @returns {Promise<string>} Parameter value returned.
 */
export async function getParameterStore(episodeEvent) {
  try {
    let parameterName = "";
    if (episodeEvent.indexOf("-") == -1) {
      parameterName = `${episodeEvent
        ?.replace(/\s+/g, "-")
        ?.toLowerCase()}-notify`;
    } else {
      const param = episodeEvent.split("-");
      for (let item of param) {
        parameterName += item;
      }
      parameterName = `${parameterName
        .replace(/\s+/g, "-")
        .toLowerCase()}-notify`;
    }
    console.log(parameterName);
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

/**
 * Retrieves Participant from DB based on participant id
 *
 * @function getParticipantFromDB
 * @async
 * @param {string} participantId Participant id.
 * @returns {Promise<Object>} Item from DynamoDB for the given participant id.
 */
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

/**
 * Send message to SQS queue
 *
 * @function sendToSQS
 * @async
 * @param {Object} item Object containing participant id and NHS number.
 * @param {string} episodeEvent Episode event type.
 */
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
