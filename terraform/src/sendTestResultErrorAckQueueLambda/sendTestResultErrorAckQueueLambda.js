//IMPORTS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

//HANDLER
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
// Function to send Message to SQS Queue
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

// Retrieve and Parse the JSON file
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

// Get JSON File from the bucket
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
