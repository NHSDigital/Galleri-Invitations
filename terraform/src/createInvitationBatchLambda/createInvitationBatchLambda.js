import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const dbClient = new DynamoDBClient({ region: "eu-west-2" });
const s3 = new S3Client({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const BUCKET = `${ENVIRONMENT}-outbound-gtms-invited-participant-batch`;
const KEY_PREFIX = "invitation_batch_";

/**
 * Lambda handler to create an invitation batch and push to S3.
 * @function handler
 * @async
 * @param {Object} event - Episode table insert dynamodb stream event.
 * @returns {string} Message that batch has been created or not.
 * @throws {Error} Processing error.
 */
export const handler = async (event) => {
  console.log("No. of episodes inserted: ", event.Records.length);
  try {
    const insertedRecords = event.Records;
    const participantIds = extractParticipantIds(insertedRecords);
    const batchArray = await getInvitationBatch(
      dbClient,
      ENVIRONMENT,
      participantIds
    );

    let msg;
    if (batchArray.length) {
      const timestamp = new Date(Date.now()).toISOString();
      const invitationBatch = { InvitedParticipantBatch: batchArray };
      await pushJsonToS3(
        s3,
        BUCKET,
        `${KEY_PREFIX}${timestamp}.json`,
        invitationBatch
      );
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

/**
 * Extracts participant ids in Episode table insert dynamodb stream.
 * @function extractParticipantIds
 * @param {Array} insertedRecordsArray - Array of inserted records.
 * @returns {Array} Participant ids.
 */
export const extractParticipantIds = (insertedRecordsArray) => {
  console.log("Extracting participant ids.");
  const participantIdArray = [];
  insertedRecordsArray.map((record) =>
    participantIdArray.push(record.dynamodb.NewImage.Participant_Id.S)
  );
  console.log("No. of participant ids extracted: ", participantIdArray.length);
  return participantIdArray;
};

/**
 * Creates invitation batch array from participant ids.
 * @function getInvitationBatch
 * @async
 * @param {DynamoDBClient} dbClient - Dynamodb client.
 * @param {string} environment - Environment name.
 * @param {Array} idArray - Array of participant ids.
 * @returns {Array} Array of participant objects (participant id, nhs number, dob).
 */
export const getInvitationBatch = async (dbClient, environment, idArray) => {
  console.log("Generating invitation batch.");
  const invitationBatch = [];
  await Promise.allSettled(
    idArray.map(async (id) => {
      const participant = await lookupParticipant(dbClient, environment, id);
      if (participant) {
        const nhsNumber =
          participant.superseded_by_nhs_number.N !== "0"
            ? participant.superseded_by_nhs_number.N
            : participant.nhs_number.N;
        const invitedParticipant = {
          participantId: id,
          nhsNumber: nhsNumber,
          dateOfBirth: participant.date_of_birth.S,
        };
        invitationBatch.push(invitedParticipant);
      }
    })
  );
  console.log("Generated invitation batch size: ", invitationBatch.length);
  return invitationBatch;
};

/**
 * Queries the Population table for a participant id.
 * @function lookupParticipant
 * @async
 * @param {DynamoDBClient} dbClient - Dynamodb client.
 * @param {string} environment - Environment name.
 * @param {string} participantId - Participant id.
 * @returns {Object} Participant object (nhs number, superseded nhs number, dob) if found.
 */
export const lookupParticipant = async (
  dbClient,
  environment,
  participantId
) => {
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
    TableName: `${environment}-Population`,
  };

  const command = new QueryCommand(param);
  const response = await dbClient.send(command);

  if (response.$metadata.httpStatusCode !== 200 || !response.Items.length) {
    console.error(
      `Participant id ${participantId} does not exist in Population table.`
    );
    return undefined;
  }
  console.log("Found participant: ", participantId);
  return response.Items[0];
};

/**
 * Puts object to S3.
 * @function pushJsonToS3
 * @async
 * @param {S3Client} client - S3 client.
 * @param {string} bucketName - S3 bucket name.
 * @param {string} key - S3 object key.
 * @param {Array} jsonArr - Array of participant objects.
 * @returns {Object} S3 put response.
 * @throws {Error}
 */
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
