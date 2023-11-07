import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

export async function getItemsFromTable(table, client) {
  const response = await client.send(
    new ScanCommand({
      TableName: table,
    })
  );

  return response;
}

export const handler = async (event, context) => {
  const client = new DynamoDBClient({ region: "eu-west-2" });

  const response = await getItemsFromTable("InvitationParameters", client);
  console.log(response);


  let responseObject = {};
  const CONFIG_ID = 1;
  const targetAppsToFill = JSON.parse(event.body).targetAppsToFill;
  const lsoaCodes = JSON.parse(event.body).lsoaCodes; //grab lsoa code e01...

  const params = {
    "Key": {
      "CONFIG_ID": {
        "N": `${CONFIG_ID}`,
      }
    },
    "TableName": "InvitationParameters"
  };

  //store response.Items quintile 1-5 into variable, forecast uptake

  // const command = new UpdateItemCommand(params); //getItems
  // const response = await client.send(command);

  //calculate breakdown of no of people per quintile

  //return all available participants out of lsoa (ppl that live in lsoa region, population table)

  //rank population in order of depravity, most to least(affluent), and create 5 quintiles by separating
  //this in 1/5ths

  //randomly select people to inv and multiple by participant uptake value e.g. 0.16, increment a counter with number i.e. 0.16
  //loop through grouped quintile until no of people per quintile is met e.g. 40/0.16

  //return to front end, value of counter

  if (response.$metadata.httpStatusCode = 200) {
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
