import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  const lsoaList = event.lsoaCodePayload;
  const client = new DynamoDBClient({ region: "eu-west-2" });

  // Loop over incoming array and for each LSOA, query the number of participants within LSOA.
  // Return counts for Eligible and Invited
  let eligibleInvitedPopulation;

  if (event.invitationsAlgorithm){
    eligibleInvitedPopulation = await getEligiblePopulation(lsoaList, client);
  } else {
    eligibleInvitedPopulation = await getPopulation(lsoaList, client);
  }

  if (Object.keys(eligibleInvitedPopulation).length > 0) {
    const complete = Date.now() - start;
    console.log("Lambda path completion took: ", complete / 1000);
    return eligibleInvitedPopulation;
  } else {
    return "none eligible";
  }
};

// METHODS
async function populateEligibleArray(client, lsoaCode){
  const tableItems = [];
  await queryEligiblePopulation(client, lsoaCode, tableItems);
  return tableItems.flat();
};

export async function queryEligiblePopulation(client, lsoaCode, tableItems) {
  const input = {
    "ExpressionAttributeValues": {
      ":code": {
        "S": `${lsoaCode}`
      }
    },
    "KeyConditionExpression": "LsoaCode = :code",
    "ProjectionExpression": "PersonId, Invited, date_of_death, removal_date",
    "TableName": "Population",
    "IndexName": "LsoaCode-index"
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  if (response.$metadata.httpStatusCode == 200) {
    tableItems.push(response.Items)
    return "Success"
  } else {
    console.log("Unsuccess")
    console.error("Response from table encountered an error")
  };
};

export async function getPopulation (lsoaList, client) {
  const populationObject = {};
  await Promise.all(lsoaList.map(async (lsoa) => {
    const lsoaCode = lsoa.S;
    const response = await populateEligibleArray(client, lsoaCode);

    let invitedPopulation = 0;
    response.forEach((person) => {
      if (person?.Invited?.S == "true" && person?.date_of_death?.S == "NULL" && person?.removal_date?.S == "NULL") {
        ++invitedPopulation;
      };
    });

    populationObject[lsoaCode] = {
      ELIGIBLE_POPULATION: {"S": response.length},
      INVITED_POPULATION: {"S": invitedPopulation}
    };
  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`);

  return populationObject;
}

// Query eligible people
export async function getEligiblePopulation(lsoaList, client) {
  const populationObject = {};
  await Promise.all(lsoaList.map(async (lsoa) => {
    // const lsoaCode = lsoa.S; //DEBUG
    // gets all the people in LSOA
    const response = await populateEligibleArray(client, lsoa);
    let count = 0 // DEBUG

    let personObject = {}
    response.forEach((person) => {
      if (person?.Invited?.S == "false" && person?.date_of_death?.S == "NULL" && person?.removal_date?.S == "NULL") {
        // DEBUG
        ++count

        personObject[person?.PersonId.S] = {
          "dateOfDeath": person?.date_of_death.S,
          "removalDate": person?.removal_date.S,
          "invited": person?.Invited?.S
        }
      };
    });

    console.log("Person object = ", JSON.stringify(personObject))
    console.log(`In ${lsoa}, there are ${count} number of people available to invite`)
    populationObject[lsoa] = personObject;
  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`);

  return populationObject;
}
