import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import uuid4 from "uuid4";

const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.ENVIRONMENT;
const SUCCESSFULL_REPSONSE = 200;

/**
 * AWS Lambda handler to set selected participant status to "to be invited" and relevant processing.
 *
 * @async
 * @function handler
 * @param {Object} event - The event triggering the Lambda.
 * @param {Object} context - The context object provided by AWS Lambda.
 * @returns {Object} - Response object containing success message or an error details.
 */
export const handler = async (event, context) => {
  const eventJson = JSON.parse(event.body);
  const personIdentifiedArray = eventJson.selectedParticipants;
  const { clinicInfo } = eventJson;
  const { createdBy } = clinicInfo;

  let responseObject = {
    headers: {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    isBase64Encoded: true,
  };

  try {
    let personUpdated = false;
    let siteUpdated = false;

    const responsePopulation = await updatePersonsToBeInvited(
      personIdentifiedArray,
      createdBy,
      client
    );
    console.log(`responsePopulation = ${responsePopulation.length}`);
    const responsePhlebotomySite = await updateClinicFields(
      clinicInfo,
      personIdentifiedArray.length,
      client
    );

    if (
      responsePopulation.every(
        (element) => element.value === SUCCESSFULL_REPSONSE
      )
    ) {
      console.log(
        `All ${responsePopulation.length} persons successfully updated`
      );
      personUpdated = true;
    } else {
      const successfulRecords = responsePopulation.reduce((curr, acc) => {
        if (curr.value === SUCCESSFULL_REPSONSE) return acc + 1;
      }, 0);
      console.log(
        `Error: Only ${successfulRecords}/${responsePopulation.length} persons were successfully updated. Contact third line support to investigate`
      );
    }

    if (responsePhlebotomySite == SUCCESSFULL_REPSONSE) {
      console.log("Site successfully updated");
      siteUpdated = true;
    }

    if (siteUpdated && personUpdated) {
      responseObject.statusCode = 200;
      responseObject.body = "Success";

      return responseObject;
    } else {
      throw new Error(`Action to update Population was successful? ${personUpdated}
        Action to update PhlebotomySite was successful? ${siteUpdated}`);
    }
  } catch (e) {
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject;
  }
};

/**
 * Update participants status to "to be invited" and assign a batch id in Population table.
 *
 * @async
 * @function updatePersonsToBeInvited
 * @param {Array<Object>} recordArray - Array of participants records.
 * @param {String} createdBy createdBy info
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @returns {Array<Promise>} Promise of array of each update result.
 */
export async function updatePersonsToBeInvited(recordArray, createdBy, client) {
  const batchId = await generateBatchID(client);

  const validParticipants = recordArray.filter((record) => {
    return record !== null;
  });
  return Promise.allSettled(
    validParticipants.map(async (record) => {
      return updateRecord(record, batchId, client, createdBy);
    })
  );
}

/**
 * Takes single record from Population DynamoDB table and
 * update that individual to have a identifiedToBeInvited field set to true
 *
 * @async
 * @function updateRecord
 * @param {Object} record - records to be written to DynamoDB.
 * @param {String} batchId unique batchId.
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @param {String} createdBy createdBy info
 * @returns {number} The HTTP status code of the update operation.
 */
export async function updateRecord(record, batchId, client, createdBy) {
  const lsoaCodeReturn = await getLsoaCode(record, client);
  const items = lsoaCodeReturn.Items;
  const lsoaCode = items[0].LsoaCode.S;

  const input = {
    ExpressionAttributeNames: {
      "#IDENTIFIED_TO_BE_UPDATED": "identified_to_be_invited",
      "#BATCH_ID": "Batch_Id",
      "#CREATED_BY": "created_by",
    },
    ExpressionAttributeValues: {
      ":to_be_invited": {
        BOOL: true,
      },
      ":batch": {
        S: `${batchId}`,
      },
      ":created": {
        S: `${createdBy}`,
      },
    },
    Key: {
      PersonId: {
        S: `${record}`,
      },
    },
    TableName: `${ENVIRONMENT}-Population`,
    UpdateExpression: `SET
      #IDENTIFIED_TO_BE_UPDATED = :to_be_invited,
      #BATCH_ID = :batch,
      #CREATED_BY = :created`,
  };

  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${record}`);
  }
  return response.$metadata.httpStatusCode;
}

/**
 * gets LSOA from the personID from Poulation Table
 *
 * @async
 * @function getLsoaCode
 * @param {String} record - personID of participant.
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @returns {Object} Query command response object.
 */
export async function getLsoaCode(record, client) {
  const input = {
    ExpressionAttributeValues: {
      ":person": {
        S: `${record}`,
      },
    },
    KeyConditionExpression: "PersonId = :person",
    ProjectionExpression: "LsoaCode",
    TableName: `${ENVIRONMENT}-Population`,
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  return response;
}

/**
 * Update the Clinic fields after invites has been sent.
 *
 * @async
 * @function updateClinicFields
 * @param {...any} clinicInfo Information about clinic - ID of the clinic, Name of the clinic,
 * Selected range, target Percentage of appointments to fill, target number of appointments to fill,
 * number of remaining appointments.
 * @param {number} invitesSent number of invites sent for this clinic
 * @param {DynamoDBClient} client Instance of DynamoDB client
 *
 * @returns {number} The HTTP status code of the update operation.
 */
export async function updateClinicFields(clinicInfo, invitesSent, client) {
  const {
    clinicId,
    clinicName,
    rangeSelected,
    targetPercentage,
    targetNoAppsToFill,
    appRemaining,
  } = clinicInfo;

  const newAvailability = Number(appRemaining) - Number(targetNoAppsToFill);

  const date = new Date(Date.now());
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const formattedDate = date
    .toLocaleDateString("en-GB", options)
    .replace(/,/g, "");

  const input = {
    ExpressionAttributeNames: {
      "#TARGET_FILL": "TargetFillToPercentage",
      "#RANGE": "LastSelectedRange",
      "#INVITE_DATE": "PrevInviteDate",
      "#INVITE_SENT": "InvitesSent",
      "#AVAILABILITY": "Availability",
    },
    ExpressionAttributeValues: {
      ":targetPercentage": {
        N: `${targetPercentage}`,
      },
      ":rangeSelected": {
        N: `${rangeSelected}`,
      },
      ":inviteDate": {
        S: `${formattedDate}`,
      },
      ":inviteSent": {
        N: `${invitesSent}`,
      },
      ":availability": {
        N: `${newAvailability}`,
      },
    },
    Key: {
      ClinicId: {
        S: `${clinicId}`,
      },
      ClinicName: {
        S: `${clinicName}`,
      },
    },
    TableName: `${ENVIRONMENT}-PhlebotomySite`,
    UpdateExpression: `SET
        #TARGET_FILL = :targetPercentage,
        #RANGE = :rangeSelected,
        #INVITE_DATE = :inviteDate,
        #INVITE_SENT = :inviteSent,
        #AVAILABILITY = :availability`,
  };
  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  return response.$metadata.httpStatusCode;
}

/**
 * Generates unique Batch id
 *
 * @async
 * @function generateBatchID
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @returns {String|Error} batch id or Error: generating batch id.
 */
export const generateBatchID = async (client) => {
  try {
    let batchUuid;
    let batchId;
    let found;
    do {
      batchUuid = uuid4();
      batchId = `IB-${batchUuid}`;
      console.log("Checking if batchId exists in Episode table");
      found = await lookupBatchId(batchId, `Population`, client);
    } while (found == 400);
    console.log(`batchId = ${batchId}`);
    return batchId;
  } catch (err) {
    console.error("Error generating batch id.");
    console.error(err);
    return err;
  }
};

/**
 * ensure no duplicate participantIDs
 *
 * @async
 * @function lookupBatchId
 * @param {string} batchId batchId
 * @param {string} table Name of the DynamoDB table
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @returns {number} The HTTP status code of the update operation.
 */
export async function lookupBatchId(batchId, table, dbClient) {
  const input = {
    ExpressionAttributeValues: {
      ":batch": {
        S: `${batchId}`,
      },
    },
    KeyConditionExpression: "Batch_Id = :batch",
    ProjectionExpression: "Batch_Id",
    TableName: `${ENVIRONMENT}-${table}`,
    IndexName: "BatchId-index",
  };

  const command = new QueryCommand(input);
  const response = await dbClient.send(command);
  if (!response.Items.length) {
    // if response is empty, no matching participantId
    return 200;
  }
  return 400;
}
