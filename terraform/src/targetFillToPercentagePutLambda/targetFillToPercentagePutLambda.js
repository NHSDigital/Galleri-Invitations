import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ENVIRONMENT = process.env.ENVIRONMENT;

/**
 * Lambda function to update target fill percentage value in DynamoDB config table.
 *
 * @function handler
 * @param {Object} event - The event object containing information about the HTTP request.
 * @param {Object} context - The context object representing the runtime information.
 * @returns {Object} - The response object containing the status code, headers, and body.
 */
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};
  const CONFIG_ID = 1;
  const targetPercentage =
    event.body !== null ? JSON.parse(event.body).targetPercentage : "";

  const params = {
    ExpressionAttributeNames: {
      "#TARGET_PERCENTAGE_VALUE": "TARGET_PERCENTAGE",
    },
    ExpressionAttributeValues: {
      ":target_percentage_new": {
        N: `${targetPercentage}`,
      },
    },
    Key: {
      CONFIG_ID: {
        N: `${CONFIG_ID}`,
      },
    },
    TableName: `${ENVIRONMENT}-InvitationParameters`,
    UpdateExpression: "SET #TARGET_PERCENTAGE_VALUE = :target_percentage_new",
  };

  const command = new UpdateItemCommand(params);
  const response = await client.send(command);

  if ((response.$metadata.httpStatusCode = 200)) {
    responseObject.statusCode = 200;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,PUT",
    };
    responseObject.isBase64Encoded = true;
  } else {
    responseObject.statusCode = 404;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,PUT",
    };
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }
  return responseObject;
};
