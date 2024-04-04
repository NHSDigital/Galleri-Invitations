import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";

//VARIABLES
const s3 = new S3Client();
const sqs = new SQSClient({});


//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  const region = 'eu-west-2';
  const accountId = process.env.account_id;
  const ENVIRONMENT = process.env.ENVIRONMENT;
  const queueName = 'notifyRawMessageQueue.fifo';
  const queueUrl = `https://sqs.${region}.amazonaws.com/${accountId}/${ENVIRONMENT}-${queueName}`;

  try {
    const JSONObj = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);

    console.log(JSONObj);

    for (let record of JSONObj) {
      const messageBody = JSON.stringify(record);
      console.log(messageBody);

      const params = {
        QueueURL: queueUrl,
        MessageBody: messageBody
      }

      try {
        await sqs.sendMessage(params).promise();
      } catch (error) {
        console.error('Error occurred:', error);
      }
    }

  } catch (error) {
    console.error("Error occurred:", error);
  }
};

//FUNCTIONS

// Retrieve and Parse the JSON file
export const retrieveAndParseJSON = async (getJSONFunc, bucket, key, client) => {
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
    console.log(response);
    return response.Body.transformToString();
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
}

