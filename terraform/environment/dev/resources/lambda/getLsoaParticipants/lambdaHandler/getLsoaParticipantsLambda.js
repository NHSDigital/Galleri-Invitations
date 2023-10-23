import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  console.log(
    "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  );
  // destructure event to get the payload of LSOAs from front end
  // const lsoaList = event.body.lsoaList;
  // placeholder lsoaList
  const lsoaList = [{
    IMD_DECILE: { N: '9' },
    NORTHING_1M: { N: '228441' },
    EASTING_1M: { N: '509665' },
    FORECAST_UPTAKE: { N: '1' },
    LSOA_2011: { S: 'E01017559' },
    DISTANCE_TO_SITE: { N: '14.19' }
  }];

  const client = new DynamoDBClient({ region: "eu-west-2" });

  // loop over array and do a query on the number of participants with LSOA that match the element on loop
  // total count of loop can be the Eligible population, and Invited would need to be another query
  // add these variables to an array of objects containing LSOA code, Eligible pop and Invited field
  // return the array
  let populationArray = []

  const lsoaCode = "E01017559"
  const input = {
    "ExpressionAttributeValues": {
      ":code": {
        "S": `${lsoaCode}`
      }
    },
    "KeyConditionExpression": "LsoaCode = :code",
    "ProjectionExpression": "PersonId",
    "TableName": "Population",
    "IndexName": "LsoaCode-index"
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  console.log("logging response: ", JSON.stringify(response.Items))

  const obj = {
    LSOA_2011: { "S": lsoaCode },
    ELIGIBLE_POPULATION: { "S": response.Count }
    // INVITED_POPULATION: {"S": invitedPopulation.Count}
  }
  // try {
  //   populationArray = lsoaList.map(lsoa => {
  //     const lsoaCode = lsoa.LSOA_2011.S
  //     const eligiblePopulation = queryEligiblePopulation(lsoaCode, client)
  //     // const invitedPopulation = queryInvitedPopulation(lsoaCode, client)
  //     return {
  //       LSOA_2011: {"S": lsoaCode},
  //       ELIGIBLE_POPULATION: {"S": eligiblePopulation.Count},
  //       // INVITED_POPULATION: {"S": invitedPopulation.Count}
  //     }
  //   })
  // } catch {
  //   console.error("Something went wrong with the queries")
  // }

  console.log(populationArray)

  // let responseObject = {};

  // if (response.hasOwnProperty("Items")) {
  //   responseObject.statusCode = 200;
  //   responseObject.isBase64Encoded = true;
  //   (responseObject.headers = {
  //     "Access-Control-Allow-Headers":
  //       "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
  //     "Access-Control-Allow-Origin": "*",
  //     "Access-Control-Allow-Methods": "OPTIONS,GET",
  //   }),
  //     (responseObject.body = JSON.stringify(populationArray));
  // } else {
  //   responseObject.statusCode = 404;
  //   responseObject.isBase64Encoded = true;
  //   responseObject.body = "error";
  // }

  const complete = Date.now() - start;
  console.log("Lambda path completion took: ", complete / 1000);
  return "";
};

// METHODS
//
async function queryEligiblePopulation(lsoaCode, client) {
  const input = {
    "ExpressionAttributeValues": {
      ":code": {
        "S": `${lsoaCode}`
      }
    },
    "KeyConditionExpression": "LsoaCode = :code",
    "ProjectionExpression": "PersonId",
    "TableName": "Population"
  };

  const command = new QueryCommand(input);
  return await client.send(command);
}
