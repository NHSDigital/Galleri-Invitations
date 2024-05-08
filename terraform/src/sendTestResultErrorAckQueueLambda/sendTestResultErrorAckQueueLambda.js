//IMPORTS
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

//HANDLER
export const handler = async (event) => {
  const sqs = new SQSClient({});
  const ENVIRONMENT = process.env.ENVIRONMENT;
  const QUEUE_URL = process.env.TEST_RESULT_ACK_QUEUE_URL;
  try {
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );
    console.log(`Triggered by object ${key} in bucket ${bucket}`);

    const sendMessageCommand = new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(message),
      // MessageGroupId: "enrichedMessage",
    });
    await sqs.send(sendMessageCommand);
    console.log(`Message sent to SQS queue for object: ${bucket}/${key}.`);
  } catch (error) {
    console.error(`Error: Failed to send message to SQS queue`);
  }
};

//FUNCTIONS

// Retrieve and Parse the JSON file
export const retrieveAndParseJSON = async (
  getJSONFunc,
  bucket,
  key,
  client
) => {
  const JSONMsgStr = await getJSONFunc(bucket, key, client);
  return JSON.parse(JSONMsgStr);
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
    console.log("Failed: ", err);
    throw err;
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
      `Error deleting object "${objectKey}" from bucket "${bucketName}":`,
      err
    );
    throw err;
  }
}
