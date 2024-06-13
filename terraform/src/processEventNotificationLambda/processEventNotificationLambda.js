import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({ region: "eu-west-2" });
const ssmClient = new SSMClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * Lambda handler function for sending participants to a SQS queue.
 *
 * @function handler
 * @async
 * @param {Object} event - The event object containing the query parameters and other details.
 * @returns {Object} HTTP response object with outcome of whether participants have been sent to queue successfully or not
 */
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
 * Retrieves a parameter from AWS Systems Manager Parameter Store based on the provided episode event.
 *
 * @param {string} episodeEvent - The episode event string used to construct the parameter name.
 * @returns {Promise<string>} - A promise that resolves to the value of the retrieved parameter.
 * @throws {Error} - Throws an error if the parameter retrieval fails.
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
 * Retrieves a participant's information from population table by participant ID.
 *
 * @param {string} participantId - The ID of the participant to retrieve.
 * @returns {Promise<Object>} - A promise that resolves to the participant's information, or null if not found.
 * @throws {Error} - Throws an error if the query to the DynamoDB table fails.
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
 * Sends a message to an SQS queue with participant information and episode event details.
 *
 * @param {Object} item - The participant information to be sent to the SQS queue.
 * @param {string} item.participantId - The ID of the participant.
 * @param {string} item.nhsNumber - The NHS number of the participant.
 * @param {string} episodeEvent - The episode event details to be included in the message.
 * @returns {Promise<void>} - A promise that resolves when the message is successfully sent to the SQS queue.
 * @throws {Error} - Throws an error if sending the message to the SQS queue fails.
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
