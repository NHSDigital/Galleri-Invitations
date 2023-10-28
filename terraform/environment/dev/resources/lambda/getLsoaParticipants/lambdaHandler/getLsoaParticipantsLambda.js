import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  // want to recursively read from the SQS queue till complete
  // use the LSOAs in the return data to query the Population table
  // when population data returns, combine it and send to front end

  // ORRRR

  // getLsoaInRangeLambda calls getLsoaParticipantsLambda
  // this then returns the count of participants
  // and then combines the results to give to the front end

  const start = Date.now();
  // console.log(
  //   "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  // );
  // destructure event to get the payload of LSOAs from front end
  const lsoaList = event
  const client = new DynamoDBClient({ region: "eu-west-2" });

  // loop over array and do a query on the number of participants with LSOA that match the element on loop
    // total count of loop can be the Eligible population, and Invited would need to be another query
    // add these variables to an array of objects containing LSOA code, Eligible pop and Invited field
  // return the array

  const eligibleInvitedPopulation = await getPopulation(lsoaList, client)

  // console.log("logging response: ", Object.keys(eligibleInvitedPopulation).length)

  let responseObject = {};

  if (Object.keys(eligibleInvitedPopulation).length > 0) {
    const complete = Date.now() - start;
    console.log("Lambda path completion took: ", complete / 1000);
    return eligibleInvitedPopulation
  } else {
    return "none eligible"
  }
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

  const command = new QueryCommand(input);
  const response = await client.send(command);


  if (response.$metadata.httpStatusCode){
    tableItems.push(response.Items)
    return
  } else {
    console.log("Unsuccess")
    console.error("Response from table encountered an error")
  }

}

async function getPopulation (lsoaList, client) {
  const populationObject = {}
  await Promise.all(lsoaList.map(async (lsoa) => {
    const lsoaCode = lsoa.S
    const response = await populateEligibleArray(client, lsoaCode)

    let invitedPopulation = 0
    response.forEach((person) => {
      if (person.Invited.S == "true") {
        ++invitedPopulation
      }
    })

    populationObject[lsoaCode] = {
      ELIGIBLE_POPULATION: {"S": response.length},
      INVITED_POPULATION: {"S": invitedPopulation}
    }

  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`)

  return populationObject;
}
