import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to post invitation parameters - forcast uptake - to Dynamo DB invitation parameters table
*/
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};
  const CONFIG_ID = '001';
  const forcastUptake = event.queryStringParameters.forcastUptake;

  const params = {
    Item: {
      CONFIG_ID: {
        N: `${CONFIG_ID}`,
      },
      FORECAST_UPTAKE: {
        N: `${forcastUptake}`,
      }
    },
    TableName: "InvitationParameters",
  };
  const command = new PutItemCommand(params);
  const response = await client.send(command);

  if (responseObject.statusCode = 200) {
    responseObject.statusCode = 200;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
    }),
      (responseObject.isBase64Encoded = true);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }
  return JSON.stringify(response);
};
