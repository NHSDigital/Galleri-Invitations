import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to post invitation parameters to Dynamo DB invitation parameters table
*/
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  let responseObject = {};
  const CONFIG_ID = 1;
  const quintile1 = event.body !== null ? JSON.parse(event.body).quintiles[0]: "";
  const quintile2 = event.body !== null ? JSON.parse(event.body).quintiles[1] : "";
  const quintile3 = event.body !== null ? JSON.parse(event.body).quintiles[2] : "";
  const quintile4 = event.body !== null ? JSON.parse(event.body).quintiles[3] : "";
  const quintile5 = event.body !== null ? JSON.parse(event.body).quintiles[4] : "";

  const params = {
    "ExpressionAttributeNames": {
      "#Q1": "QUINTILE_1",
      "#Q2": "QUINTILE_2",
      "#Q3": "QUINTILE_3",
      "#Q4": "QUINTILE_4",
      "#Q5": "QUINTILE_5",
    },
    "ExpressionAttributeValues": {
      ":q1_new": {
        "N": `${quintile1}`
      },
      ":q2_new": {
        "N": `${quintile2}`
      },
      ":q3_new": {
        "N": `${quintile3}`
      },
      ":q4_new": {
        "N": `${quintile4}`
      },
      ":q5_new": {
        "N": `${quintile5}`
      },
    },
    "Key": {
      "CONFIG_ID": {
        "N": `${CONFIG_ID}`,
      }
    },
    "TableName": "InvitationParameters",
    "UpdateExpression": "SET #Q1 = :q1_new, #Q2 = :q2_new, #Q3 = :q3_new, #Q4 = :q4_new, #Q5 = :q5_new"
  };

  const command = new UpdateItemCommand(params);
  const response = await client.send(command);

  if (response.$metadata.httpStatusCode == 200) {
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
