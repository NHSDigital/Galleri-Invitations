//IMPORTS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

/**
 * Lambda handler function to process SNS messages and send them to an SQS queue.
 *
 * @function handler
 * @async
 * @param {Object} event - The Lambda event object containing SNS message details.
 */
export const handler = async (event) => {
  // VARIABLES
  const QUEUE_URL = process.env.TEST_RESULT_ACK_QUEUE_URL;
  const QUEUE_NAME = QUEUE_URL.split("/").pop();
  const sqs = new SQSClient({});
  try {
    console.log(
      `Triggered by message published on SNS Topic: ${event.Records[0].Sns.TopicArn.split(
        ":"
      ).pop()} at ${event.Records[0].Sns.Timestamp}`
    );
    await processSnsMessage(
      event,
      sendMessageToQueue,
      QUEUE_URL,
      sqs,
      QUEUE_NAME
    );
  } catch (error) {
    console.error(`Lambda process was not successful in this instance`);
    console.error(`Error: ${error}`);
  }
};

//FUNCTIONS

/**
 * process the message published on SNS Topic and sends a message to the SQS Queue.
 *
 * @function processSnsMessage
 * @async
 * @param {Object} message - The message object to be sent to the SQS queue.
 * @param {string} queue - The SQS queue URL where the message is published.
 * @param {SQSClient} sqsClient - The SQS client.
 * @param {string} snsMessageId - The SNS message ID.
 * @param {string} QUEUE_NAME - The name of the SQS Queue where the message is published.
 * @throws {Error}  Will throw an error if sending message to SQS fails.
 */
export async function processSnsMessage(
  event,
  sendMsgToSqs,
  queue,
  sqsClient,
  QUEUE_NAME
) {
  try {
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const snsMessageId = event.Records[0].Sns.MessageId;

    // Check if required FHIR result id exist in the parsed message
    if (!snsMessage || !snsMessage.grail_FHIR_result_id) {
      throw new Error("Missing required fields in SNS message");
    }

    const okAckResponseObject = {
      grail_fhir_result_id: snsMessage.grail_FHIR_result_id,
      ack_code: "ok",
    };
    console.log(
      `Preview of Ok acknowledgement response object attributes: ${okAckResponseObject}`
    );

    await sendMsgToSqs(okAckResponseObject, queue, sqsClient, snsMessageId);
    console.log(`Successfully sent the message to SQS Queue: ${QUEUE_NAME}`);
  } catch (error) {
    console.error(`Error: Failed to send message to SQS queue: ${QUEUE_NAME}`);
    throw error;
  }
}

/**
 * Sends a message to the SQS Queue.
 *
 * @function sendMessageToQueue
 * @async
 * @param {Object} message - The message object to be sent to the SQS queue.
 * @param {string} queue - The SQS queue URL.
 * @param {SQSClient} sqsClient - The SQS client.
 * @param {string} snsMessageId - The SNS message ID.
 * @throws {Error} Will throw an error if sending message to SQS fails.
 */
export async function sendMessageToQueue(
  message,
  queue,
  sqsClient,
  snsMessageId
) {
  const sendMessageCommand = new SendMessageCommand({
    QueueUrl: queue,
    MessageBody: JSON.stringify(message),
    MessageGroupId: "okAckResponse",
  });

  try {
    await sqsClient.send(sendMessageCommand);
    console.log(
      `Message sent to SQS queue for SNS Message_ID:${snsMessageId}.`
    );
  } catch (error) {
    console.error(`Error: Failed to send message to SQS queue`);
    throw error;
  }
}
