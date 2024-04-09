import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

//VARIABLES
const s3 = new S3Client();
const sqs = new SQSClient({});

//HANDLER
export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const JSONObj = await retrieveAndParseJSON(getJSONFromS3, bucket, key, s3);
    await processJSONObj(JSONObj, sqs);
  } catch (error) {
    console.error("Error occurred whilst processing JSON file from S3");
    console.error("Error:", error);
  }
};

//FUNCTIONS
// Process JSON file and send to SQS queue
export async function processJSONObj(jsonObj, client) {
  const totalRecords = jsonObj.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSent = 0;

  for (let record of jsonObj) {
    const messageBody = {
      participantId: record.participantId,
      nhsNumber: record.nhsNumber,
      episodeEvent: "Invited",
    };

    const sendMessageCommand = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: "invitedParticipant",
    });
    O;

    try {
      await client.send(sendMessageCommand);
      recordsSuccessfullySent++;
      console.log(
        `Message successfully sent for participantId: ${record.participantId}`
      );
    } catch (error) {
      recordsFailedToSent++;
      console.error(
        `Failed to send message for participantId: ${record.participantId}`
      );
      console.error("Error:", error);
    }
  }

  console.log(
    `Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSent}`
  );
}

// Process JSON file and send to SQS queue
export async function processJSONObj(jsonObj, client) {
  const totalRecords = jsonObj.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSent = 0;

  for (let record of jsonObj) {
    const messageBody = {
      participantId: record.participantId,
      nhsNumber: record.nhsNumber,
      episodeEvent: "Invited",
    };

    const sendMessageCommand = new SendMessageCommand({
      QueueUrl: process.env.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(messageBody),
      MessageGroupId: "invitedParticipant",
    });

    try {
      await client.send(sendMessageCommand);
      recordsSuccessfullySent++;
      console.log(
        `Message successfully sent for participantId: ${record.participantId}`
      );
    } catch (error) {
      recordsFailedToSent++;
      console.error(
        `Failed to send message for participantId: ${record.participantId}`
      );
      console.error("Error:", error);
    }
  }

  console.log(
    `Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSent}`
  );
}

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
    console.error(`Failed to get object key ${key} from bucket ${bucketName}`);
    console.error("Error:", err);
    throw err;
  }
}
