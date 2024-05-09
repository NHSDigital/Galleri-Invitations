//IMPORTS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// VARIABLES
const QUEUE_URL = process.env.TEST_RESULT_ACK_QUEUE_URL;
const QUEUE_NAME = QUEUE_URL.split("/").pop();
const s3 = new S3Client();
const sqs = new SQSClient({});

//HANDLER
export const handler = async (event) => {
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
    await sendMessageToQueue(JSONMsgObject, QUEUE_URL, sqs);
    await deleteObjectFromS3(bucket, key, s3);
    console.log(`Successfully sent the message to SQS Queue - ${QUEUE_NAME}`);
  } catch (error) {
    console.error(`Lambda process was not successful in this instance`);
    console.error(`Error: ${error}`);
  }
};

//FUNCTIONS

// Function to send Message to SQS Queue
export async function sendMessageToQueue(message, queue, sqsClient) {
  const sendMessageCommand = new SendMessageCommand({
    QueueUrl: queue,
    MessageBody: JSON.stringify(message),
    MessageGroupId: "errorAckResponse",
  });

  try {
    await sqsClient.send(sendMessageCommand);
    console.log(`Message sent to SQS queue for object: ${bucket}/${key}.`);
  } catch (error) {
    console.error(`Error: Failed to send message to SQS queue`);
    throw new Error(error);
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
      `Error: Failed to retrieve and parse JSON File ${key} from bucket ${bucketName}`
    );
    throw new Error(error);
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
    throw new Error(err);
  }
}

// Delete an object from an S3 bucket
export async function deleteObjectFromS3(bucketName, objectKey, client) {
  try {
    const response = await client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
    console.log(
      `Object "${objectKey}" deleted successfully from bucket "${bucketName}".`
    );
    return response.$metadata.httpStatusCode;
  } catch (err) {
    console.error(
      `Error deleting object "${objectKey}" from bucket "${bucketName}"`
    );
    console.error("Error: ", err);
    throw new Error(err);
  }
}
