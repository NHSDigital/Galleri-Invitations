import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to load invitation parameters and pass on to GPS client.
*/
export const handler = async () => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};

  const CONFIG_ID_VALUE = 1;

  const params = {
    Key: {
      CONFIG_ID: {
        N: `${CONFIG_ID_VALUE}`,
      },
    },
    TableName: `${ENVIRONMENT}-InvitationParameters`,
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  if (response.hasOwnProperty("Item")) {
    responseObject.statusCode = 200;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.isBase64Encoded = true;
    responseObject.body = JSON.stringify(response.Item);
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
};
