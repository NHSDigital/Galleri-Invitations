import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to load icb information and pass on to GPS client.
*/
export const handler = async () => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  const input = {
    TableName: "ParticipatingIcb",
  };

  const command = new ScanCommand(input);
  const response = await client.send(command);

  let responseObject;

  if (response.hasOwnProperty("Items")) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    },
    responseObject.body = response.Items?.map((el) => {
        return JSON.stringify(el.IcbCode.S, null, 2);
    });
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }

  return responseObject;
};
