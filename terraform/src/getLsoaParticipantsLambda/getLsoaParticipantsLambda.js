import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/
export const handler = async (event, context) => {
  const start = Date.now();
  const client = new DynamoDBClient({ region: "eu-west-2" });
  console.log('EVENT -abdul');
  console.log(event);
  // {
  //   lsoaCodePayload: {
  //     type: 'Buffer',
  //     data: [
  //        34,  92,  34, 123,  92,  92,  92,  34, 116,  97, 114, 103,
  //       101, 116,  65, 112, 112, 115,  84, 111,  70, 105, 108, 108,
  //        92,  92,  92,  34,  58,  49,  55,  55,  44,  92,  92,  92,
  //        34, 108, 115, 111,  97,  67, 111, 100, 101, 115,  92,  92,
  //        92,  34,  58, 123,  92,  92,  92,  34,  69,  48,  49,  48,
  //        48,  48,  48,  48,  53,  92,  92,  92,  34,  58, 123,  92,
  //        92,  92,  34,  73,  77,  68,  95,  68,  69,  67,  73,  76,
  //        69,  92,  92,  92,  34,  58,  92,  92,  92,  34,  51,  92,
  //        92,  92,  34,  44,
  //       ... 376 more items
  //     ]
  //   },
  //   invitationsAlgorithm: true
  // }

  // console.log(event.lsoaCodePayload.data);
  // console.log(payload);
  // console.log('typeof event');
  // console.log(typeof event);
  // console.log('typeof lsoaCodePayload');
  // console.log(typeof event.lsoaCodePayload);
  // console.log(event.lsoaCodePayload);

  // console.log(JSON.parse(event));
  // console.log(JSON.parse(event.invitationsAlgorithm));
  // console.log(JSON.stringify(event));
  // const payload = event.lsoaCodePayload.toString();

  // Loop over incoming array and for each LSOA, query the number of participants within LSOA.
  // Return counts for Eligible and Invited
  let eligibleInvitedPopulation;
  console.log('is invitation algorithm key there?');
  console.log(event.invitationsAlgorithm);
  if (event.invitationsAlgorithm) {
    // const payload = JSON.parse(event.lsoaCodePayload).body;
    // const payload = JSON.parse(event.lsoaCodePayload).lsoaCodes;
    // const payload = JSON.parse(event.lsoaCodePayload).data;
    console.log('PAYLOAD -abdul');
    const buff = Buffer.from(event.lsoaCodePayload);
    console.log(buff);
    const payload = JSON.parse(JSON.parse(JSON.parse(buff.toString('utf-8'))))?.lsoaCodes;
    console.log(payload);


    // const payload = event.lsoaCodePayload.toString();
    // console.log(JSON.parse(payload));
    // console.log(JSON.parse(JSON.parse(payload)));


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
  // console.log('lsoaList -abdul');
  // console.log(lsoaList);
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
      ELIGIBLE_POPULATION: { "S": eligiblePopulation },
      INVITED_POPULATION: { "S": invitedPopulation }
    };
  }));

  console.log(`lsoa being queried number ${lsoaList.length}. Population object has ${Object.keys(populationObject).length}`);

  return populationObject;
}

// Query eligible people
export async function getEligiblePopulation(lsoaList, client) {
  const populationArray = [];
  // console.log("OBJECT KEYS -abdul");
  // console.log(lsoaList);
  // console.log(typeof lsoaList);
  // console.log(lsoaList["E01000005"]);

  await Promise.all(Object.keys(lsoaList).map(async (lsoa) => {
    // console.log('LSOA -abdul');
    // console.log(lsoa);
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
