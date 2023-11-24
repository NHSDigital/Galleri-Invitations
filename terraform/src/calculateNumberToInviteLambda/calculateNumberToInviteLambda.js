import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new DynamoDBClient({ region: "eu-west-2" });
const lambdaClient = new LambdaClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  //values extracted from front-end payload when calculate number to invite button is fired
  const targetAppsToFill = event.body !== null ? JSON.parse(event.body).targetAppsToFill : "";
  const lsoaInfo = event.body !== null ? JSON.stringify(event.body.replace(/ /g, '')) : "";

  const buffer = Buffer.from(JSON.stringify(lsoaInfo));

  const CONFIG_ID = 1;
  const response = await getItemsFromTable("InvitationParameters", client, CONFIG_ID);

  let responseObject = {
    "headers": {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    "isBase64Encoded": true
  };

  // Store Quintile 1-5 into variable and National Forecast Uptake
  const quintile1 = response.Item !== null ? (response.Item).QUINTILE_1.N : "";
  const quintile2 = response.Item !== null ? (response.Item).QUINTILE_2.N : "";
  const quintile3 = response.Item !== null ? (response.Item).QUINTILE_3.N : "";
  const quintile4 = response.Item !== null ? (response.Item).QUINTILE_4.N : "";
  const quintile5 = response.Item !== null ? (response.Item).QUINTILE_5.N : "";
  const nationalForecastUptake = response.Item !== null ? (response.Item).FORECAST_UPTAKE.N : "";

  // Calculate breakdown of no of people per quintile
  const quintile1Target = targetAppsToFill * (quintile1 / 100);
  const quintile2Target = targetAppsToFill * (quintile2 / 100);
  const quintile3Target = targetAppsToFill * (quintile3 / 100);
  const quintile4Target = targetAppsToFill * (quintile4 / 100);
  const quintile5Target = targetAppsToFill * (quintile5 / 100);

  // Return participants available to invite
  const payload = {
    lsoaCodePayload: buffer,
    invitationsAlgorithm: true
  }
  const returnData = await invokeParticipantListLambda("getLsoaParticipantsLambda", payload, lambdaClient)
  const participantInLsoa = returnData.sort((a, b) => {
    return a.imdDecile - b.imdDecile
  })
  const numberOfPeople = participantInLsoa.length
  console.log("participantInLsoa.length = ", numberOfPeople)

  // Split incoming person data into quintile blocks
  // Get Quintile block size
  const quintileBlockSize = Math.floor(numberOfPeople / 5)
  console.log(`quintileBlockSize = ${quintileBlockSize}`)

  //QUINTILE 1 Block
  const q1UpperBound = quintileBlockSize
  const quintile1Population = generateQuintileBlocks(participantInLsoa, 0, q1UpperBound, "Q1")
  //QUINTILE 2 Block
  const q2UpperBound = q1UpperBound + quintileBlockSize + 1
  const quintile2Population = generateQuintileBlocks(participantInLsoa, q1UpperBound + 1, q2UpperBound, "Q2")
  //QUINTILE 3 Block
  const q3UpperBound = q2UpperBound + quintileBlockSize + 1
  const quintile3Population = generateQuintileBlocks(participantInLsoa, q2UpperBound + 1, q3UpperBound, "Q3")
  //QUINTILE 4 Block
  const q4UpperBound = q3UpperBound + quintileBlockSize + 1
  const quintile4Population = generateQuintileBlocks(participantInLsoa, q3UpperBound + 1, q4UpperBound, "Q4")
  //QUINTILE 5 Block
  const quintile5Population = generateQuintileBlocks(participantInLsoa, q4UpperBound + 1, numberOfPeople, "Q5")

  // Store selected participants in single array
  const selectedParticipants = [
    ...getParticipantsInQuintile(quintile1Population, quintile1Target, nationalForecastUptake, "Q1"),
    ...getParticipantsInQuintile(quintile2Population, quintile2Target, nationalForecastUptake, "Q2"),
    ...getParticipantsInQuintile(quintile3Population, quintile3Target, nationalForecastUptake, "Q3"),
    ...getParticipantsInQuintile(quintile4Population, quintile4Target, nationalForecastUptake, "Q4"),
    ...getParticipantsInQuintile(quintile5Population, quintile5Target, nationalForecastUptake, "Q5"),
  ]

  const numberOfPeopleToInvite = selectedParticipants.length
  console.log("numberOfPeopleToInvite = ", numberOfPeopleToInvite)

  if (response.$metadata.httpStatusCode = 200) {
    responseObject.statusCode = 200;
    responseObject.body = JSON.stringify({
      "selectedParticipants": selectedParticipants,
      "numberOfPeopleToInvite": numberOfPeopleToInvite
    })
  } else {
    responseObject.statusCode = 404;
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

export async function invokeParticipantListLambda(lamdaName, payload, lambdaClient) {
  //Change format of JSON to expected format when sending payload to subsequent lambda
  const input = {
    FunctionName: lamdaName,
    Payload: JSON.stringify(payload),
  };
  const command = new InvokeCommand(input);
  const response = await lambdaClient.send(command);

  return JSON.parse(Buffer.from(response.Payload).toString());
}

export const getParticipantsInQuintile = (quintilePopulation, quintileTarget, nationalForecastUptake, Q) => {
  console.log(`In ${Q}. # people available to invite = ${quintilePopulation.length}. Target to meet = ${quintileTarget}`)
  let count = 0;
  const selectedParticipants = []
  //Select random person within quintile, loop through until quintile target is met
  while (count < quintileTarget) {
    const randomPersonIndex = Math.floor(Math.random() * (quintilePopulation.length - 1))
    const personSelected = quintilePopulation[randomPersonIndex]
    if (!selectedParticipants.includes((el) => {
      return el = personSelected;
    })) {
      selectedParticipants.push(personSelected.personId)
      count += (personSelected.forecastUptake) / 100
    }
  }
  return selectedParticipants
}

export const generateQuintileBlocks = (participantList, lowerBound, upperBound, quintile) => {
  console.log(`${quintile} Lower bound = ${lowerBound}. ${quintile} Upper bound = ${upperBound}`)
  return participantList.slice(lowerBound, upperBound)
}
