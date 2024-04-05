import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

//VARIABLES
const s3 = new S3Client();
const sqs = new SQSClient({});


//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const JSONObj = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);

    for (let record of JSONObj) {
      const messageBody = {
        participantId: record.participantId,
        nhsNumber: record.nhsNumber,
        episodeEvent: 'Invited'
      }

      const sendMessageCommand = new SendMessageCommand({
        QueueUrl: process.env.SQS_QUEUE_URL,
        MessageBody: JSON.stringify(messageBody),
        MessageGroupId: 'invitedParticipant'
      });

      try {
        const result = await sqs.send(sendMessageCommand);
        console.log('Message sent:', result.MessageId);
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

