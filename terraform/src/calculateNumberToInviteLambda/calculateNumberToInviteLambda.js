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
    },
    "E01001902": {
      "IMD_DECILE": 6,
      "FORECAST_UPTAKE": 20
    },
    "E01001345": {
      "IMD_DECILE": 6,
      "FORECAST_UPTAKE": 20
    },
    "E01023749": {
      "IMD_DECILE": 10,
      "FORECAST_UPTAKE": 40
    },
    "E01014702": {
      "IMD_DECILE": 7,
      "FORECAST_UPTAKE": 25
    },
    "E01015768": {
      "IMD_DECILE": 5,
      "FORECAST_UPTAKE": 18
    },
    "E01020272": {
      "IMD_DECILE": 3,
      "FORECAST_UPTAKE": 15
    },
    "E01028809": {
      "IMD_DECILE": 4,
      "FORECAST_UPTAKE": 16
    },
    "E01012621": {
      "IMD_DECILE": 1,
      "FORECAST_UPTAKE": 10
    },
    "E01028549": {
      "IMD_DECILE": 8,
      "FORECAST_UPTAKE": 25
    },
    "E01011568": {
      "IMD_DECILE": 9,
      "FORECAST_UPTAKE": 18
    },
    "E01032669": {
      "IMD_DECILE": 7,
      "FORECAST_UPTAKE": 15
    },
    "E01003556": {
      "IMD_DECILE": 2,
      "FORECAST_UPTAKE": 16
    },
    "E01022357": {
      "IMD_DECILE": 9,
      "FORECAST_UPTAKE": 10
    }
  }

  const CONFIG_ID = 1;

  const response = await getItemsFromTable("InvitationParameters", client, CONFIG_ID);
  let responseObject = {};

  const targetAppsToFill = 10;

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
    lsoaCodePayload: lsoaInfo,
    invitationsAlgorithm: true
  }

  const input = {
    FunctionName: "getLsoaParticipantsLambda",
    Payload: JSON.stringify(payload),
  };
  const command = new InvokeCommand(input);
  const responseA = await lambdaClient.send(command);

  const participantInLsoa = JSON.parse(Buffer.from(responseA.Payload).toString())
  console.log("participantInLsoa.length = ", participantInLsoa.length)

  // console.log("participantInLsoa = ", participantInLsoa)

  // connect LsoaInfo with participantsInLsoa
  const participantInLsoaIncoming =  [
    { personId: '9000211252', dateOfDeath:  'NULL', removalDate: 'NULL', invited: 'false', imdDecile: 2, forecastUptake: 13, lsoaCode: 'E01022970' },
    { personId: '9000174777', dateOfDeath: 'NULL', removalDate: 'NULL', invited: 'false', imdDecile: 2, forecastUptake: 13, lsoaCode: 'E01022970' },
    { personId: '9000011589', dateOfDeath: 'NULL', removalDate: 'NULL', invited: 'false', imdDecile: 9, forecastUptake: 35, lsoaCode: 'E01030492' },
    { personId: '9000230168', dateOfDeath: 'NULL', removalDate: 'NULL', invited: 'false', imdDecile: 9, forecastUptake: 35, lsoaCode: 'E01030492' }
  ]

  //rank population in order of depravity, least(affluent) to most, and create 5 quintiles by separating
  //this in 1/5ths
  const numberOfPeople = participantInLsoa.length
  console.log(`numberOfPeople = ${numberOfPeople}`)
  const quintileBlockSize = Math.floor(numberOfPeople/5)
  console.log(`quintileBlockSize = ${quintileBlockSize}`)

  //QUINTILE 1
  const q1UpperBound = quintileBlockSize
  console.log(`Q1 Lower bound = 0. Q1 Upper bound = ${q1UpperBound}`)
  const quintile1Population = participantInLsoa.sort((a, b) => {
    return a.imdDecile < b.imdDecile
  }).slice(0, q1UpperBound)
  //QUINTILE 2
  const q2UpperBound = q1UpperBound + quintileBlockSize
  console.log(`Q2 Lower bound = ${q1UpperBound + 1}. Q2 Upper bound = ${q2UpperBound}`)
  const quintile2Population = participantInLsoa.sort((a, b) => {
    return a.imdDecile < b.imdDecile
  }).slice(q1UpperBound + 1, q2UpperBound)
  //QUINTILE 3
  const q3UpperBound = q2UpperBound + quintileBlockSize
  console.log(`Q3 Lower bound = ${q2UpperBound + 1}. Q3 Upper bound = ${q3UpperBound}`)
  const quintile3Population = participantInLsoa.sort((a, b) => {
    return a.imdDecile < b.imdDecile
  }).slice(q2UpperBound + 1, q3UpperBound)
  //QUINTILE 4
  const q4UpperBound = q3UpperBound + quintileBlockSize
  console.log(`Q4 Lower bound = ${q3UpperBound + 1}. Q4 Upper bound = ${q4UpperBound}`)
  const quintile4Population = participantInLsoa.sort((a, b) => {
    return a.imdDecile < b.imdDecile
  }).slice(q3UpperBound + 1, q4UpperBound)
  //QUINTILE 5
  const endOfList = q4UpperBound + quintileBlockSize
  console.log(`Q5 Lower bound = ${q4UpperBound + 1}. Q5 Upper bound = ${endOfList}`)
  const quintile5Population = participantInLsoa.sort((a, b) => {
    return a.imdDecile < b.imdDecile
  }).slice(q4UpperBound + 1, endOfList)

  const selectedParticipants = [
    ...getParticipantsInQuintile(quintile1Population, quintile1Target, "Q1"),
    ...getParticipantsInQuintile(quintile2Population, quintile2Target, "Q2"),
    ...getParticipantsInQuintile(quintile3Population, quintile3Target, "Q3"),
    ...getParticipantsInQuintile(quintile4Population, quintile4Target, "Q4"),
    ...getParticipantsInQuintile(quintile5Population, quintile5Target, "Q5"),
  ]

  console.log("Selected participants = ", selectedParticipants)
  const numberOfPeopleToInvite = selectedParticipants.length
  console.log("numberOfPeopleToInvite = ", numberOfPeopleToInvite)
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

const getParticipantsInQuintile = (quintilePopulation, quintileTarget, Q) => {
  console.log(`In ${Q}. # people available to invite = ${quintilePopulation.length}. Target to meet = ${quintileTarget}`)
  let count = 0;
  const selectedParticipants = []
  // console.log("Printing population: ", quintilePopulation)
  while (count < quintileTarget){
    const randomPersonIndex = Math.floor(Math.random() * (quintilePopulation.length - 1))
    const personSelected = quintilePopulation[randomPersonIndex]
    // console.log(`Selecting random person at index ${randomPersonIndex}: ${JSON.stringify(personSelected)}`)
    selectedParticipants.push(personSelected)
    count += (personSelected.forecastUptake)/100
  }
  return selectedParticipants
}
