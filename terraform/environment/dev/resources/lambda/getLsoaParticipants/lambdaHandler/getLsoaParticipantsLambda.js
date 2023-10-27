import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  // console.log(
  //   "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  // );
  // destructure event to get the payload of LSOAs from front end
  // const lsoaList = event.queryParameterString.lsoaList;
  // placeholder lsoaList
  const lsoaList = [{
    IMD_DECILE: { N: '9' },
    NORTHING_1M: { N: '228441' },
    EASTING_1M: { N: '509665' },
    FORECAST_UPTAKE: { N: '1' },
    LSOA_2011: { S: 'E01001902' },
    DISTANCE_TO_SITE: { N: '14.19' }
  },
  {
    IMD_DECILE: { N: '9' },
    NORTHING_1M: { N: '228441' },
    EASTING_1M: { N: '509665' },
    FORECAST_UPTAKE: { N: '1' },
    LSOA_2011: { S: 'E01001345' },
    DISTANCE_TO_SITE: { N: '14.19' }
  }];

  const client = new DynamoDBClient({ region: "eu-west-2" });

  // loop over array and do a query on the number of participants with LSOA that match the element on loop
    // total count of loop can be the Eligible population, and Invited would need to be another query
    // add these variables to an array of objects containing LSOA code, Eligible pop and Invited field
  // return the array

  const eligibleInvitedPopulation = await getPopulation(lsoaList, client)

  console.log("logging response: ", eligibleInvitedPopulation)

  let responseObject = {};

  if (eligibleInvitedPopulation.length > 0) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }),
      (responseObject.body = JSON.stringify(eligibleInvitedPopulation));
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }

  const complete = Date.now() - start;
  console.log("Lambda path completion took: ", complete / 1000);
  return responseObject;
};

// METHODS
//

async function populateEligibleArray(client, lsoaCode){
  const tableItems = []
  let lastEvaluatedItem = {}
  await queryEligiblePopulation(client, lsoaCode, lastEvaluatedItem , tableItems)
  return tableItems.flat()
}

async function queryEligiblePopulation(client, lsoaCode, lastEvaluatedItem = {}, tableItems) {
  const input = {
    "ExpressionAttributeValues": {
      ":code": {
        "S": `${lsoaCode}`
      }
    },
    "KeyConditionExpression": "LsoaCode = :code",
    "ProjectionExpression": "PersonId, Invited",
    "TableName": "Population",
    "IndexName": "LsoaCode-index"
  };
  // if (Object.keys(lastEvaluatedItem).length != 0){
  //   input.ExclusiveStartKey = lastEvaluatedItem;
  // }

  const command = new QueryCommand(input);
  const response = await client.send(command);

  console.log(response)

  if (response.$metadata.httpStatusCode){
    console.log("Success")
    tableItems.push(response.Items)
    return
    // lastEvaluatedItem = response.LastEvaluatedKey
    // await queryEligiblePopulation(client, lsoaCode, lastEvaluatedItem = {}, tableItems)
  } else {
    console.log("Unsuccess")
    console.error("Response from table encountered an error")
  }

  // if (response.LastEvaluatedKey) {
  //   console.log("response.LastEvaluatedKey = ", response.LastEvaluatedKey)
  // } else {
  //   // run last invocation
  //   console.log("Finished table?")
  //   // console.log("at last bit")
  //   // input.ExclusiveStartKey = lastEvaluatedItem;
  //   // const command = new QueryCommand(input);
  //   // const response = await client.send(command);

  //   // if (response.$metadata.httpStatusCode){
  //   //   tableItems.push(response.Items)
  //   //   return `Population table scanned. Returning ${tableItems.length} records`
  //   // } else {
  //   //   console.error("Something went wrong with last request")
  //   // }
  // }
}

async function getPopulation (lsoaList, client) {
  const populationArray = []
  await Promise.all(lsoaList.map(async (lsoa) => {
    const lsoaCode = lsoa.LSOA_2011.S
    // const response = await queryEligiblePopulation(lsoaCode, client);
    const response = await populateEligibleArray(client, lsoaCode)

    console.log("Response in getPopulation = ", response)

    // console.log("response from request = ", JSON.stringify(response.Items))

    let invitedPopulation = 0
    response.forEach((person) => {
      if (person.Invited.S == "true") {
        ++invitedPopulation
      }
    })

    const obj =  {
      LSOA_2011: {"S": lsoaCode},
      ELIGIBLE_POPULATION: {"S": response.length},
      INVITED_POPULATION: {"S": invitedPopulation}
    }

    populationArray.push(obj)
  }));
  return populationArray;
}
