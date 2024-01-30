import {
  DynamoDBClient,
  QueryCommand
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  PutObjectCommand
}
from '@aws-sdk/client-s3';

const dbClient = new DynamoDBClient({ region: "eu-west-2" });
const s3 = new S3Client({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const BUCKET = `${ENVIRONMENT}-invitation-batch-bucket`;
const KEY_PREFIX = "invitation_batch_";

export const handler = async (event) => {
  console.log("No. of episodes inserted: ", event.Records.length);
  try {
    const insertedRecords = event.Records;
    const participantIds = extractParticipantIds(insertedRecords);
    const batchArray = await getInvitationBatch(dbClient, ENVIRONMENT, participantIds);

    let msg;
    if (batchArray.length) {
      const timestamp = (new Date(Date.now())).toISOString();
      await pushJsonToS3(s3, BUCKET, `${KEY_PREFIX}${timestamp}.json`, batchArray);
      msg = "Finished creating invitation batch.";
    } else {
      msg = "Empty invitation batch not saved to S3.";
    }

    console.log(msg);
    return msg;
  } catch (error) {
    return error.message;
  }
};

export const extractParticipantIds = (insertedRecordsArray) => {
  console.log("Extracting participant ids.");
  const participantIdArray = [];
  insertedRecordsArray.map(
    (record) => participantIdArray.push(record.dynamodb.NewImage.Participant_Id.S)
  );
  console.log("No. of participant ids extracted: ", participantIdArray.length);
  return participantIdArray;
};

export const getInvitationBatch = async (dbClient, environment, idArray) => {
  console.log("Generating invitation batch.");
  const invitationBatch = [];
  await Promise.allSettled(
    idArray.map(async (id) => {
      const participant = await lookupParticipant(dbClient, environment, id);
      if (participant) {
        const nhsNumber = (participant.superseded_by_nhs_number.S !== "0"
          ? participant.superseded_by_nhs_number.S
          : participant.nhs_number.S);
        invitationBatch.push({
          participantId: id,
          nhsNumber: nhsNumber,
          dateOfBirth: participant.date_of_birth.S
        });
      }
  }));
  console.log("Generated invitation batch size: ", invitationBatch.length);
  return invitationBatch;
};

export const lookupParticipant = async (dbClient, environment, participantId) => {
  console.log("Looking up participant: ", participantId);
    const param = {
      ExpressionAttributeValues: {
        ":id": {
          S: participantId,
        },
      },
      KeyConditionExpression: "PersonId = :id",
      Limit: 1,
      ProjectionExpression: "nhs_number, superseded_by_nhs_number, date_of_birth",
      TableName: `${environment}-Population`
    };

    const command = new QueryCommand(param);
    const response = await dbClient.send(command);

    if (response.$metadata.httpStatusCode !== 200 || !response.Items.length) {
      console.error(`Participant id ${participantId} does not exist in Population table.`);
      return undefined;
    }
    return response.Items[0];
};


export const pushJsonToS3 = async (client, bucketName, key, jsonArr) => {
  console.log(`Pushing object key ${key} to bucket ${bucketName}`);
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: JSON.stringify(jsonArr),
      })
    );
    console.log(`Finished pushing object key ${key} to bucket ${bucketName}`);
    return response;
  } catch (err) {
    console.error("Error pushing to S3: ", err);
    throw err;
  }
};

