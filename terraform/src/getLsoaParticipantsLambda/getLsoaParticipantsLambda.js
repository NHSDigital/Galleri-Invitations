import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  let eligibleInvitedPopulation;

  if (event.invitationsAlgorithm) {
    //Initialize Buffer from buffer array and convert back to original payload sent from front end
    const buff = Buffer.from(event.lsoaCodePayload);
    //Required to unpack payload to a readable format for lambda to process values
    const payload = JSON.parse(JSON.parse(JSON.parse(buff.toString('utf-8'))))?.lsoaCodes;

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
export async function populateEligibleArray(client, lsoaCode){
  const tableItems = [];
  await queryEligiblePopulation(client, lsoaCode, tableItems);
  console.log(tableItems)
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
    let eligiblePopulation = 0;
    response.forEach((person) => {
      if (person?.date_of_death?.S == "NULL" && person?.removal_date?.S == "NULL") {
        ++eligiblePopulation
        if (person?.Invited?.S == "true") {
          ++invitedPopulation;
        };
      }
    });

    populationObject[lsoaCode] = {
      ELIGIBLE_POPULATION: {"S": eligiblePopulation},
      INVITED_POPULATION: {"S": invitedPopulation}
    };
  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`);

  return populationObject;
}

// Query eligible people
export async function getEligiblePopulation(lsoaList, client) {
  const populationArray = [];

  await Promise.all(Object.keys(lsoaList).map(async (lsoa) => {
    const response = await populateEligibleArray(client, lsoa);

    response.forEach((person) => {
      if (person?.Invited?.S == "false" && person?.date_of_death?.S == "NULL" && person?.removal_date?.S == "NULL") {
        populationArray.push({
          "personId": person?.PersonId.S,
          "imdDecile": lsoaList[lsoa].IMD_DECILE,
          "forecastUptake": lsoaList[lsoa].FORECAST_UPTAKE
        })

      };
    });

    // console.log(`In ${lsoa}, there are ${count} number of people available to invite`)
  }));

  console.log(`lsoa being queried number ${Object.keys(lsoaList).length}. Population object has ${populationArray.length}`);
  console.log('popArr');
  console.log(populationArray);
  return populationArray;
}
