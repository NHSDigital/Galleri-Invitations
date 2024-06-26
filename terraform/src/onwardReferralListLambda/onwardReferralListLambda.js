import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * AWS Lambda handler to load participant info for participants with result - CSD.
 *
 * @async
 * @function handler
 * @param {Object} event - The event triggering the Lambda.
 * @param {Object} context - The context object provided by AWS Lambda.
 * @returns {Promise<Object>} - A promise that resolves to the response object containing participant info or an error message.
 */
export const handler = async (event, context) => {
  console.log("Entered OnwardReferralList lambda");
  try {
    const participantList = await lookupParticipantsCsd(client);

    console.log(`Number of participants: ${participantList.length}`);

    const tableItems = [];
    let lastEvaluatedItem = {};
    await lookupParticipantsInfo(
      participantList,
      client,
      lastEvaluatedItem,
      tableItems
    );
    const participantsInfo = tableItems.flat();
    console.log(
      `Number of participant info records: ${participantsInfo.length}`
    );

    let responseObject = {};

    if (participantsInfo.length !== 0) {
      responseObject.statusCode = 200;
      responseObject.isBase64Encoded = true;
      responseObject.headers = {
        "Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      };
      responseObject.body = JSON.stringify(participantsInfo);
    } else {
      responseObject.statusCode = 404;
      responseObject.headers = {
        "Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      };
      responseObject.isBase64Encoded = true;
      responseObject.body = "error";
    }
    return responseObject;
  } catch (error) {
    console.log("Error occured in OnwardReferralList lambda");
    console.error(`Error: ${error}`);
  }
};

/**
 * Looks up participants with the latest result as CSD from the episode table.
 *
 * @async
 * @function lookupParticipantsCsd
 * @param {DynamoDBClient} client - The DynamoDB client.
 * @returns {Promise<Array>} - A promise that resolves to an array of participants.
 * @throws {Error} - Throws an error if the operation fails.
 */
export const lookupParticipantsCsd = async (client) => {
  console.log("Entered function lookupParticipantsCsd");

  try {
    const cancerSignalDetected = "Result - CSD";

    const input = {
      ExpressionAttributeValues: {
        ":a": {
          S: `${cancerSignalDetected}`,
        },
      },
      FilterExpression: "Episode_Event = :a",
      ProjectionExpression: "Participant_Id",
      TableName: `${ENVIRONMENT}-Episode`,
      IndexName: "Episode_Event-index",
    };

    const command = new ScanCommand(input);
    const response = await client.send(command);

    console.log("Exiting function lookupParticipantsCsd");
    return response.Items;
  } catch (error) {
    console.log("Error in lookupParticipantsCsd");
    throw error;
  }
};

/**
 * Looks up participant information based on a list of participant IDs.
 *
 * @async
 * @function lookupParticipantsInfo
 * @param {Array} participantList - List of participant IDs.
 * @param {DynamoDBClient} client - The DynamoDB client.
 * @param {Object} lastEvaluatedItem - The last evaluated item for pagination.
 * @param {Array} tableItems - The array to store table items.
 * @returns {Promise<string|void>} - A promise that resolves to a success message or void if recursion occurs.
 * @throws {Error} - Throws an error if the operation fails.
 */
export const lookupParticipantsInfo = async (
  participantList,
  client,
  lastEvaluatedItem,
  tableItems
) => {
  console.log("Entered function lookupParticipantsInfo");
  try {
    let participantIds = [];
    if (participantList.length) {
      participantList.forEach((obj) => {
        participantIds.push(obj.Participant_Id.S);
      });

      var idsObject = {};
      var index = 0;
      participantIds.forEach(function (id) {
        index++;
        var idKey = ":pId" + index;
        idsObject[idKey.toString()] = { S: id };
      });

      const input = {
        ExpressionAttributeNames: {
          "#PI": "Participant_Id",
          "#BDD": "Blood_Draw_Date",
          "#RC": "Result_Creation",
          "#PN": "Participant_Name",
        },
        ExpressionAttributeValues: idsObject,
        FilterExpression: "#PI IN (" + Object.keys(idsObject).toString() + ")",
        ProjectionExpression: "#PI, #BDD, #RC, #PN",
        TableName: `${ENVIRONMENT}-GalleriBloodTestResult`,
      };

      if (Object.keys(lastEvaluatedItem).length != 0) {
        input.ExclusiveStartKey = lastEvaluatedItem;
      }

      const command = new ScanCommand(input);
      const response = await client.send(command);

      if (response.LastEvaluatedKey) {
        if (response.$metadata.httpStatusCode == 200) {
          console.log(
            "Table is larger than 1Mb hence recursively routing through to obtain all data"
          );
          tableItems.push(response.Items);
          lastEvaluatedItem = response.LastEvaluatedKey;
          await lookupParticipantsInfo(client, lastEvaluatedItem, tableItems);
        } else {
          console.log("Unsuccess");
          console.error("Error: Response from table encountered an error");
        }
      } else {
        // run last invocation
        console.log("at last bit");
        const command = new ScanCommand(input);
        const response = await client.send(command);

        if (response.$metadata.httpStatusCode == 200) {
          tableItems.push(response.Items);
          console.log("Exiting function lookupParticipantsInfo");
          return `Galleri Test Results table scanned. Returning ${tableItems.length} records`;
        } else {
          console.error("Error: Something went wrong with last request");
        }
      }
    }
  } catch (error) {
    console.error("Error in lookupParticipantsInfo");
    throw error;
  }
};
