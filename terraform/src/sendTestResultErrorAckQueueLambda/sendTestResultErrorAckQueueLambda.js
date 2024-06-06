//IMPORTS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

//HANDLER
/**
 * Lambda handler function to process S3 events and send messages to an SQS queue.
 *
 * @function handler
 * @async
 * @param {Object} event - The Lambda event object containing S3 event details.
 */
export const handler = async (event) => {
  // VARIABLES
  const QUEUE_URL = process.env.TEST_RESULT_ACK_QUEUE_URL;
  const QUEUE_NAME = QUEUE_URL.split("/").pop();
  const s3 = new S3Client();
  const sqs = new SQSClient({});
  try {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log(`Triggered by object ${key} in bucket ${bucket}`);
    const JSONMsgObject = await retrieveAndParseJSON(
      getJSONFromS3,
      bucket,
      key,
      s3
    );
    // Check if required FHIR result id exist in the parsed JSON file from the bucket
    if (!JSONMsgObject || !JSONMsgObject.id) {
      throw new Error("Missing required fields in JSON object");
    }
    const grailFhirResultId = JSONMsgObject.id;
    const errorAckResponseObject = {
      grail_fhir_result_id: grailFhirResultId,
      ack_code: "fatal-error",
    };
    console.log(
      "Preview of error acknowledgement response object attributes",
      errorAckResponseObject
    );
    await sendMessageToQueue(errorAckResponseObject, QUEUE_URL, sqs, key);
    console.log(`Successfully sent the message to SQS Queue: ${QUEUE_NAME}`);
  } catch (error) {
    console.error(`Lambda process was not successful in this instance`);
    console.error(`Error: ${error}`);
  }
};

//FUNCTIONS

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
export async function sendMessageToQueue(message, queue, sqsClient, key) {
  const sendMessageCommand = new SendMessageCommand({
    QueueUrl: queue,
    MessageBody: JSON.stringify(message),
    MessageGroupId: "errorAckResponse",
  });

  try {
    await sqsClient.send(sendMessageCommand);
    console.log(`Message sent to SQS queue for object:${key}.`);
  } catch (error) {
    console.error(`Error: Failed to send message to SQS queue`);
    throw error;
  }
}

/**
 * This function retrieves and parse JSON file from S3 bucket
 *
 * @function retrieveAndParseJSON
 * @async
 * @param {Function} getJSONFunc - Function to get JSON from S3
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {S3Client} client - S3 client
 * @returns {Object} Parsed JSON object
 * @throws {Error} If there is an error retrieving or parsing the JSON file
 */
export const retrieveAndParseJSON = async (
  getJSONFunc,
  bucket,
  key,
  client
) => {
  try {
    const JSONMsgStr = await getJSONFunc(bucket, key, client);
    return JSON.parse(JSONMsgStr);
  } catch (error) {
    console.error(
      `Error: Failed to retrieve and parse JSON File ${key} from bucket ${bucket}`
    );
    throw error;
  }
};

/**
 * This function retrieves a JSON file from the S3 bucket
 *
 * @function getJSONFromS3
 * @async
 * @param {string} bucketName - Name of the S3 bucket
 * @param {string} key - Key of the object in the S3 bucket
 * @param {S3Client} client - S3 client
 * @returns {string} JSON string from the S3 object
 * @throws {Error} If there is an error retrieving the JSON file
 */
export async function getJSONFromS3(bucketName, key, client) {
  console.log(`Getting object key ${key} from bucket ${bucketName}`);
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    console.log(`Finished getting object key ${key} from bucket ${bucketName}`);
    return response.Body.transformToString();
  } catch (err) {
    console.error(`Error getting object "${key}" from bucket "${bucketName}"`);
    console.error("Error: ", err);
    throw err;
  }
}
