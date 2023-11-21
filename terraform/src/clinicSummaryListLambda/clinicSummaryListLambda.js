import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to load clinics from and ICB and pass on to GPS client.
*/
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  // get the
  const participatingIcbSelection =
    event.queryStringParameters.participatingIcb;

  const input = {
    ExpressionAttributeNames: {
      "#CI": "ClinicId",
      "#CN": "ClinicName",
      "#PID": "PrevInviteDate",
      "#AV": "Availability",
      "#IS": "InvitesSent",
      "#IC": "ICBCode",
      "#UD": "UpdatedDate"
    },
    ExpressionAttributeValues: {
      ":a": {
        S: `${participatingIcbSelection}`,
      },
    },
    FilterExpression: "ICBCode = :a",
    ProjectionExpression: "#CI, #CN, #PID, #AV, #IS, #IC, #UD",
    TableName: "PhlebotomySite",
  };

  const command = new ScanCommand(input);
  const response = await client.send(command);

  let responseObject = {};

  if (response.hasOwnProperty("Items")) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }
    responseObject.body = JSON.stringify(response.Items);
  } else {
    responseObject.statusCode = 404;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }

  console.log(responseObject);

  return responseObject;
};
