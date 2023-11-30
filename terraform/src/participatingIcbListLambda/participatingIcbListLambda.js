import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to load icb information and pass on to GPS client.
*/

export async function getItemsFromTable(table, client) {
  const response = await client.send(
    new ScanCommand({
      TableName: table,
    })
  );

  return response;
}

export const handler = async () => {
  const client = new DynamoDBClient({ region: "eu-west-2" });
  const response = await getItemsFromTable(
    `${ENVIRONMENT}-ParticipatingIcb`,
    client
  );

  let responseObject = {};

  if (response.hasOwnProperty("Items")) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.body = JSON.stringify(
      response.Items.map((el) => {
        return el.IcbCode.S;
      })
    );
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
