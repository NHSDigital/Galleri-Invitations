import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  const client = new DynamoDBClient({ region: "eu-west-2" });
  console.log('EVENT -abdul');
  console.log(JSON.stringify(event));

  // Loop over incoming array and for each LSOA, query the number of participants within LSOA.
  // Return counts for Eligible and Invited
  let eligibleInvitedPopulation;

  if (event.invitationsAlgorithm) {
    // const payload = JSON.parse(event.lsoaCodePayload).body;
    const payload = JSON.parse(event.lsoaCodePayload).lsoaCodes;
    console.log(payload);
    // console.log(payload);
    eligibleInvitedPopulation = await getEligiblePopulation(payload, client);
  } else {
    eligibleInvitedPopulation = await getPopulation(event, client);
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
async function populateEligibleArray(client, lsoaCode) {
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

export async function getPopulation(lsoaList, client) {
  console.log('lsoaList -abdul');
  console.log(lsoaList);
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
      ELIGIBLE_POPULATION: { "S": response.length },
      INVITED_POPULATION: { "S": invitedPopulation }
    };
  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`);

  return populationObject;
}

// Query eligible people
export async function getEligiblePopulation(lsoaList, client) {
  const populationArray = [];
  console.log("OBJECT KEYS -abdul");
  console.log(lsoaList);
  console.log(typeof lsoaList);
  console.log(lsoaList["E01000005"]);

  await Promise.all(Object.keys(lsoaList).map(async (lsoa) => {
    console.log('LSOA -abdul');
    console.log(lsoa);
    // const lsoaCode = lsoa.S; //DEBUG
    // gets all the people in LSOA
    const response = await populateEligibleArray(client, lsoa);
    let count = 0 // DEBUG

    response.forEach((person) => {
      if (person?.Invited?.S == "false" && person?.date_of_death?.S == "NULL" && person?.removal_date?.S == "NULL") {
        // DEBUG
        ++count

        populationArray.push({
          "personId": person?.PersonId.S,
          "dateOfDeath": person?.date_of_death.S,
          "removalDate": person?.removal_date.S,
          "invited": person?.Invited?.S,
          "imdDecile": lsoaList[lsoa].IMD_DECILE,
          "forecastUptake": lsoaList[lsoa].FORECAST_UPTAKE,
          "lsoaCode": lsoa
        })

      };
    });

    // console.log(`In ${lsoa}, there are ${count} number of people available to invite`)
  }));

  console.log(`lsoa being queried number ${Object.keys(lsoaList).length}. Population object has ${populationArray.length}`);

  return populationArray;
}
