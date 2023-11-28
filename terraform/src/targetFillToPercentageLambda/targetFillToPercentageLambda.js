import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const ENVIRONMENT = process.env.environment;

const client = new DynamoDBClient({ region: "eu-west-2" });

let responseObject = {};

const CONFIG_ID_VALUE = 1;

/*
  Lambda to load target percentage from DynamoDB for clinic invitation screen
*/
export const handler = async () => {
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

  const attribute = { targetPercentage: response.Item.TARGET_PERCENTAGE };

  if (response.Item?.TARGET_PERCENTAGE !== null) {
    responseObject.statusCode = 200;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.isBase64Encoded = true;
    responseObject.body = JSON.stringify(attribute);
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
