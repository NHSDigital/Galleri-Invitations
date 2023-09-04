import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to load clinic information and pass on to GPS client.
*/
export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });
  const { eventClinicId, eventClinicName } = event;

  var params = {
    Key: {
      ClinicId: {
        S: `${eventClinicId}`,
      },
      ClinicName: {
        S: `${eventClinicName}`,
      },
    },
    TableName: "PhlebotomySite",
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  let responseObject = {};

  if (response.hasOwnProperty("Item")) {
    responseObject.statusCode = 200;
    responseObject.body = response.Item;
  } else {
    responseObject.statusCode = 404;
    responseObject.body = "error";
  }

  return responseObject;
};
