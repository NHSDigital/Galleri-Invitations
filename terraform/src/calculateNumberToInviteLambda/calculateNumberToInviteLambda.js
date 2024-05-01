import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const client = new DynamoDBClient({ region: "eu-west-2" });
const lambdaClient = new LambdaClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event, context) => {
  const targetAppsToFill =
    event.body !== null ? JSON.parse(event.body).targetAppsToFill : "";
  const lsoaInfo =
    event.body !== null ? JSON.stringify(event.body.replace(/ /g, "")) : "";

  const buffer = Buffer.from(JSON.stringify(lsoaInfo));

  const CONFIG_ID = 1;
  const response = await getItemsFromTable(
    `${ENVIRONMENT}-InvitationParameters`,
    client,
    CONFIG_ID
  );

  let responseObject = {
    headers: {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    isBase64Encoded: true,
  };

  // Store Quintile 1-5 into variable and National Forecast Uptake
  const quintile1 = response.Item !== null ? response.Item.QUINTILE_1.N : "";
  const quintile2 = response.Item !== null ? response.Item.QUINTILE_2.N : "";
  const quintile3 = response.Item !== null ? response.Item.QUINTILE_3.N : "";
  const quintile4 = response.Item !== null ? response.Item.QUINTILE_4.N : "";
  const quintile5 = response.Item !== null ? response.Item.QUINTILE_5.N : "";
  const nationalForecastUptake =
    response.Item !== null ? response.Item.FORECAST_UPTAKE.N : "";

  // Calculate breakdown of no of people per quintile
  const quintile1Target = Math.ceil(targetAppsToFill * (quintile1 / 100));
  const quintile2Target = Math.ceil(targetAppsToFill * (quintile2 / 100));
  const quintile3Target = Math.ceil(targetAppsToFill * (quintile3 / 100));
  const quintile4Target = Math.ceil(targetAppsToFill * (quintile4 / 100));
  const quintile5Target = Math.floor(targetAppsToFill * (quintile5 / 100));

  // Return participants available to invite
  const payload = {
    lsoaCodePayload: buffer,
    invitationsAlgorithm: true,
  };
  const returnData = await invokeParticipantListLambda(
    `${ENVIRONMENT}-getLsoaParticipantsLambda`,
    payload,
    lambdaClient
  );
  const participantInLsoa = returnData.sort((a, b) => {
    return a.imdDecile - b.imdDecile;
  });
  const numberOfPeople = participantInLsoa.length;
  console.log("participantInLsoa.length = ", numberOfPeople);

  // Split incoming person data into quintile blocks
  const quintileBlockSize = Math.floor(numberOfPeople / 5);
  console.log(`quintileBlockSize = ${quintileBlockSize}`);

  //QUINTILE 1 Block
  const q1UpperBound = quintileBlockSize;
  const quintile1Population = generateQuintileBlocks(
    participantInLsoa,
    0,
    q1UpperBound,
    "Q1"
  );
  //QUINTILE 2 Block
  const q2UpperBound = q1UpperBound + quintileBlockSize;
  const quintile2Population = generateQuintileBlocks(
    participantInLsoa,
    q1UpperBound,
    q2UpperBound,
    "Q2"
  );
  //QUINTILE 3 Block
  const q3UpperBound = q2UpperBound + quintileBlockSize;
  const quintile3Population = generateQuintileBlocks(
    participantInLsoa,
    q2UpperBound,
    q3UpperBound,
    "Q3"
  );
  //QUINTILE 4 Block
  const q4UpperBound = q3UpperBound + quintileBlockSize;
  const quintile4Population = generateQuintileBlocks(
    participantInLsoa,
    q3UpperBound,
    q4UpperBound,
    "Q4"
  );
  //QUINTILE 5 Block
  const quintile5Population = generateQuintileBlocks(
    participantInLsoa,
    q4UpperBound,
    numberOfPeople,
    "Q5"
  );

  // Store selected participants in single array
  try {
    const selectedParticipants = [
      ...getParticipantsInQuintile(
        quintile1Population,
        quintile1Target,
        nationalForecastUptake,
        "Q1"
      ),
      ...getParticipantsInQuintile(
        quintile2Population,
        quintile2Target,
        nationalForecastUptake,
        "Q2"
      ),
      ...getParticipantsInQuintile(
        quintile3Population,
        quintile3Target,
        nationalForecastUptake,
        "Q3"
      ),
      ...getParticipantsInQuintile(
        quintile4Population,
        quintile4Target,
        nationalForecastUptake,
        "Q4"
      ),
      ...getParticipantsInQuintile(
        quintile5Population,
        quintile5Target,
        nationalForecastUptake,
        "Q5"
      ),
    ];
    const numberOfPeopleToInvite = selectedParticipants.length;
    console.log("numberOfPeopleToInvite = ", numberOfPeopleToInvite);

    responseObject.statusCode = 200;
    responseObject.body = JSON.stringify({
      selectedParticipants: selectedParticipants,
      numberOfPeopleToInvite: numberOfPeopleToInvite,
    });

    return responseObject;
  } catch (e) {
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject;
  }
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

export async function invokeParticipantListLambda(
  lamdaName,
  payload,
  lambdaClient
) {
  //Change format of JSON to expected format when sending payload to subsequent lambda
  const input = {
    FunctionName: lamdaName,
    Payload: JSON.stringify(payload),
  };
  const command = new InvokeCommand(input);
  const response = await lambdaClient.send(command);

  return JSON.parse(Buffer.from(response.Payload).toString());
}

// Convert array of objects to an object with key = personId and value = uptake
// Randomly select a participants from above object
// Add their forecast uptake to count
// Remove them from the object
// Store the personId in selectedParticipants set
export const getParticipantsInQuintile = (
  quintilePopulation,
  quintileTarget,
  nationalForecastUptake,
  Q
) => {
  console.log(
    `In ${Q}. # people available to invite = ${quintilePopulation.length}. Target to meet = ${quintileTarget}`
  );
  let quintilePopulationObject = quintilePopulation.reduce(
    (obj, person) =>
      Object.assign(obj, {
        [person.personId]: person.moderator * nationalForecastUptake,
      }),
    {}
  ); // O(n)
  const quintilePopulationObjectKeys = Object.keys(quintilePopulationObject); // O(n)

  let count = 0;
  let iterationNumber = 0;
  let selectedParticipantCount = 1;
  const selectedParticipants = new Set();

  // Select random person within quintile, loop through until quintile target is met
  while (count < quintileTarget) {
    iterationNumber++;

    const sizeAfterIteration =
      quintilePopulationObjectKeys.length - iterationNumber;

    const localQuintilePopulationObjectKeys = Object.keys(
      quintilePopulationObject
    );

    const randomPersonIndex = Math.floor(
      Math.random() * localQuintilePopulationObjectKeys.length
    );
    const personSelectedId =
      localQuintilePopulationObjectKeys[randomPersonIndex];

    // person has not been previous indexed
    if (!selectedParticipants.has(personSelectedId)) {
      console.log(`Person ${personSelectedId}`);
      if(personSelectedId !== undefined){
      selectedParticipants.add(personSelectedId);
      const personSelectedForecastUptake =
        quintilePopulationObject[personSelectedId];
      count += personSelectedForecastUptake / 100;
      }
      // increment selectedPerson count
      selectedParticipantCount++;
      // remove that person from pool of people that can be invited
      delete quintilePopulationObject[personSelectedId];
    } else {
      console.log(`Person ${personSelectedId} has already been landed on`);
      // check if length of the original quintilePopulationObject isn't 0
      if (sizeAfterIteration > 0) {
        // still records left to parse
        continue;
      } else {
        // break out of loop as gone through all records but cant generate enough invites
        console.log(
          `Reached the MAX size of iteraitons with quintile block. Iterations = ${iterationNumber} and original object size is ${quintilePopulationObjectKeys.length}\nBreaking out of loop`
        );
        return new Error("Unable to generate enough invitations");
      }
    }
  }
  console.log(
    `Highlighted participants size = ${
      selectedParticipants.size
    } with an average quintile block uptake of ${Math.floor(
      (quintileTarget / selectedParticipants.size) * 100
    )}%`
  );
  return selectedParticipants;
};

export const generateQuintileBlocks = (
  participantList,
  lowerBound,
  upperBound,
  quintile
) => {
  console.log(
    `${quintile} Lower bound = ${lowerBound}. ${quintile} Upper bound = ${upperBound}`
  );
  return participantList.slice(lowerBound, upperBound);
};
