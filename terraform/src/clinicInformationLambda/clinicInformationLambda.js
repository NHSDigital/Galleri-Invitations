import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

let environment = process.env.environment;
/*
  Lambda to load clinic information and pass on to GPS client.
*/
export const handler = async (event, context) => {
  console.log(
    "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  );

  const client = new DynamoDBClient({ region: "eu-west-2" });

  const clinicId = event.queryStringParameters.clinicId;
  const clinicName = event.queryStringParameters.clinicName;

  var params = {
    Key: {
      ClinicId: {
        S: `${clinicId}`,
      },
      ClinicName: {
        S: `${clinicName}`,
      },
    },
    TableName: `${environment}-PhlebotomySite`,
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  let responseObject = {};

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
