import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to PUT invitation parameters - forecast uptake - to Dynamo DB invitation parameters table
*/
export const handler = async (event, context) => {

  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};
  const CONFIG_ID = 1;
  const forecastUptake = JSON.parse(event.body).forecastUptake;

  const params = {
    "ExpressionAttributeNames": {
      "#FORECAST_UPTAKE_VALUE": "FORECAST_UPTAKE"
    },
    "ExpressionAttributeValues": {
      ":forecast_uptake_new": {
        "N": `${forecastUptake}`
      }
    },
    "Key": {
      "CONFIG_ID": {
        "N": `${CONFIG_ID}`,
      }
    },
    "TableName": "InvitationParameters",
    "UpdateExpression": "SET #FORECAST_UPTAKE_VALUE = :forecast_uptake_new"
  };

  const command = new UpdateItemCommand(params);
  const response = await client.send(command);

  if (response.$metadata.httpStatusCode = 200) {
    responseObject.statusCode = 200;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,PUT",
    }),
      (responseObject.isBase64Encoded = true);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }
  return responseObject;
};
