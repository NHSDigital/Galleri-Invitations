import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to post invitation parameters to Dynamo DB invitation parameters table
*/
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};

  const quintile1 = event.queryStringParameters.quintile1;
  const quintile2 = event.queryStringParameters.quintile2;
  const quintile3 = event.queryStringParameters.quintile3;
  const quintile4 = event.queryStringParameters.quintile4;
  const quintile5 = event.queryStringParameters.quintile5;

  const params = {
    Item: {
      QUINTILE_1: {
        N: `${quintile1}`,
      },
      QUINTILE_2: {
        N: `${quintile2}`,
      },
      QUINTILE_3: {
        N: `${quintile3}`,
      },
      QUINTILE_4: {
        N: `${quintile4}`,
      },
      QUINTILE_5: {
        N: `${quintile5}`,
      },
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
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }),
      (responseObject.isBase64Encoded = true);
    responseObject.body = JSON.stringify(response.Item);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }

  return responseObject;
};
