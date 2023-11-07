import { DynamoDBClient, ScanCommand, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  // const targetAppsToFill = event.body !== null ? JSON.parse(event.body).targetAppsToFill : "";
  // const lsoaCodes = event.body !== null ? JSON.parse(event.body).lsoaCodes : ""; //grab lsoa code [e01...,e0212]
  const lsoaInfo = {
    "E01022970": {
      "IMD_DECILE": 2,
      "FORECAST_UPTAKE": 13
    },
    "E01030492": {
      "IMD_DECILE": 9,
      "FORECAST_UPTAKE": 35
    }
  }

  const CONFIG_ID = 1;

  const response = await getItemsFromTable("InvitationParameters", client, CONFIG_ID);
  console.log(response);
  let responseObject = {};

  const targetAppsToFill = '2000';

  //store response.Items quintile 1-5 into variable, forecast uptake
  const quintile1 = response.Item !== null ? (response.Item).QUINTILE_1.N : "";
  const quintile2 = response.Item !== null ? (response.Item).QUINTILE_2.N : "";
  const quintile3 = response.Item !== null ? (response.Item).QUINTILE_3.N : "";
  const quintile4 = response.Item !== null ? (response.Item).QUINTILE_4.N : "";
  const quintile5 = response.Item !== null ? (response.Item).QUINTILE_5.N : "";
  const forecastUptake = response.Item !== null ? (response.Item).FORECAST_UPTAKE.N : "";

  //calculate breakdown of no of people per quintile
  //get lsoaCode array, find all people from all codes, calculate total. Divide total length by 5 for quintile division.
  // match each entry to lsoaCode array to population table in dynamo and pull selected value into object/array.
  const quintile1Target = targetAppsToFill * (quintile1 / 100);
  const quintile2Target = targetAppsToFill * (quintile2 / 100);
  const quintile3Target = targetAppsToFill * (quintile3 / 100);
  const quintile4Target = targetAppsToFill * (quintile4 / 100);
  const quintile5Target = targetAppsToFill * (quintile5 / 100);

  //return all available participants out of lsoa (ppl that live in lsoa region, population table)
  const lambdaClient = new LambdaClient({ region: "eu-west-2" });
  // try {
  const payload = {
    lsoaCodePayload: Object.keys(lsoaInfo),
    invitationsAlgorithm: true
  }

  const input = {
    FunctionName: "getLsoaParticipantsLambda",
    Payload: JSON.stringify(payload),
  };
  const command = new InvokeCommand(input);
  const responseA = await lambdaClient.send(command);

  console.log("logging invoke lambda response: ", responseA)

  const participantInLsoa = JSON.parse(Buffer.from(responseA.Payload).toString())

  console.log("participantInLsoa = ", participantInLsoa)
  // }
  // catch (err) {
  //   console.log(err)
  // }
  //rank population in order of depravity, most to least(affluent), and create 5 quintiles by separating
  //this in 1/5ths
  //sort by IMD_DECILE from POSTCODE dynamo table, then split into 5 arrays/objects
  // .sort((a, b) => {
  // return (
  //   Number(b.IMD_DECILE) - Number(a.IMD_DECILE)
  // );

  //items per chunck would be arr.length/5
  //.reduce((resultArray, item, index) => {
  //   const chunckIndex = Math.floor(index/perChunk)

  //   if(!resultArray[chunkIndex]) {
  //     resultArray[chunkIndex] = []
  //   }
  //   resultArray[chunkIndex].push(item)
  //   return resultArray
  // }, []);

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




//METHODS
export async function getItemsFromTable(table, client, key) {

  const params = {
    Key: {
      CONFIG_ID: {
        N: `${key}`,
      },
    },
    TableName: table,
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  return response;
}
