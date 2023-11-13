import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import axios from "axios";

const KMTOMILES = 1.6;
const MTOKM = 1000;

/*
  Lambda to get LSOA in a 100 mile range from the selected clinic
*/
export const handler = async (event, context) => {
  const start = Date.now();
  // CALCULATE DISTANCE BETWEEN SITE AND LSOAs. RETURN THOSE IN 100 MILE RANGE

  // TODO: when accurate clinic data recieved then remove placeholder
  let clinicPostcode = event.queryStringParameters.clinicPostcode;
  // Placeholder
  clinicPostcode = "SE1 9RT";
  const lsoasInRangeMiles = event.queryStringParameters.miles;

  // make API request to get the easting and northing of postcode
  const clinicGridReference = await getClinicEastingNorthing(clinicPostcode);

  const dynamoDbclient = new DynamoDBClient({ region: "eu-west-2" });

  const records = await populateLsoaArray(dynamoDbclient);
  console.log(`Total records from dynamoDB = ${records.length}`);

  const lsoaCodePayload = []
  const filterLsoaRecords = records.filter((lsoaRecord) => {
    const distanceToSiteMiles = calculateDistance(lsoaRecord, clinicGridReference);
    if (distanceToSiteMiles <= lsoasInRangeMiles) {
      // attach to record
      lsoaRecord.DISTANCE_TO_SITE = {
        N: JSON.stringify(Math.round(distanceToSiteMiles * 100) / 100)
      };
      lsoaCodePayload.push(lsoaRecord.LSOA_2011)
      return lsoaRecord;
    }
  });

  console.log("filterRecords length = ", filterLsoaRecords.length);

  // FIND THE PARTICIPANTS IN THOSE LSOAs AND COMBINE THE RESPECTIVE ARRAYS
  const lambdaClient = new LambdaClient({ region: "eu-west-2" });

  const input = {
    FunctionName: "getLsoaParticipantsLambda",
    Payload: JSON.stringify(lsoaCodePayload),
  };
  const command = new InvokeCommand(input);
  const response = await lambdaClient.send(command);

  const participantInLsoa = JSON.parse(Buffer.from(response.Payload).toString())

  const combinedLsoaParticipants = generateLsoaTableData(filterLsoaRecords, participantInLsoa)

  console.log("combinedLsoaParticipants = ", combinedLsoaParticipants.length)

  let responseObject = {};

  if (records.length != 0) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }
    responseObject.body = JSON.stringify(combinedLsoaParticipants);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    },
    responseObject.body = "error";
  }

  const complete = Date.now() - start;
  console.log("Lambda path completion took: ", complete / 1000);
  return responseObject;
};

// METHODS
export async function getClinicEastingNorthing(postcode) {
  const startGetClinicEastingNorthing = Date.now();
  try {
    const postcodeData = await axios.get(
      `https://api.postcodes.io/postcodes/${postcode}`
    );
    const requestStatus = postcodeData.data.status;
    const postcodeEasting = postcodeData.data.result?.eastings;
    const postcodeNorthing = postcodeData.data.result?.northings;

    if (requestStatus == 200) {
      const complete = Date.now() - startGetClinicEastingNorthing;
      console.log("Success")
      console.log(
        "SUCCESSFUL completion of getClinicEastingNorthing took: ",
        complete / 1000
      );
      return {
        easting: postcodeEasting,
        northing: postcodeNorthing,
      };
    } else {
      throw new Error("Grid coordinates not returned by api");
    }
  } catch (e) {
    const complete = Date.now() - startGetClinicEastingNorthing;
    console.log("Unsuccess")
    console.log(
      "UNSUCCESSFUL completion of getClinicEastingNorthing took: ",
      complete / 1000
    );
    console.error("Error when trying to retrieve postcode grid reference ");
  }
}

export async function scanLsoaTable(client, lastEvaluatedItem, tableItems) {
  const input = {
    ExpressionAttributeNames: {
      "#LC": "LSOA_2011",
      "#ET": "AVG_EASTING",
      "#NT": "AVG_NORTHING",
      "#ID": "IMD_DECILE",
      "#FU": "FORECAST_UPTAKE",
    },
    ProjectionExpression: "#LC, #ET, #NT, #ID, #FU",
    TableName: "UniqueLsoa",
  };
  if (Object.keys(lastEvaluatedItem).length != 0){
    input.ExclusiveStartKey = lastEvaluatedItem;
  }

  const command = new ScanCommand(input);
  const response = await client.send(command);

  if (response.LastEvaluatedKey) {
    if (response.$metadata.httpStatusCode == 200){
      console.log("Table is larger than 1Mb hence recursively routing through to obtain all data")
      tableItems.push(response.Items)
      lastEvaluatedItem = response.LastEvaluatedKey
      await scanLsoaTable(client, lastEvaluatedItem, tableItems)
    } else {
      console.log("Unsuccess")
      console.error("Response from table encountered an error")
    }
  } else {
    // run last invocation
    console.log("at last bit")
    input.ExclusiveStartKey = lastEvaluatedItem;
    const command = new ScanCommand(input);
    const response = await client.send(command);

    if (response.$metadata.httpStatusCode == 200){
      tableItems.push(response.Items)
      return `UniqueLsoa table scanned. Returning ${tableItems.length} records`
    } else {
      console.error("Something went wrong with last request")
    }
  }
}

async function populateLsoaArray(client){
  const tableItems = []
  let lastEvaluatedItem = {}
  await scanLsoaTable(client, lastEvaluatedItem, tableItems)
  return tableItems.flat()
}

export const calculateDistance = (lsoa, clinicGridReference) => {
  // get the easting and northing from clinic
  const clinicEasting = Number(clinicGridReference.easting);
  const clinicNorthing = Number(clinicGridReference.northing);

  // get the easting and northing from lsoa
  const lsoaEasting = Number(lsoa.AVG_EASTING.S);
  const lsoaNorthing = Number(lsoa.AVG_NORTHING.S);

  // calculate straight line distance
  const distanceMiles =
    Math.sqrt(
      Math.pow(Math.abs(clinicEasting - lsoaEasting), 2) +
      Math.pow(Math.abs(clinicNorthing - lsoaNorthing), 2)
    )/
    (MTOKM * KMTOMILES);

  return distanceMiles;
};

export function generateLsoaTableData(lsoaData, populationData) {
  const tableInfo = []
  console.log(`lsoaData.length = ${lsoaData.length}| populationData.length = ${Object.keys(populationData).length}`)

  lsoaData.forEach((lsoaItem) => {
    const matchingLsoa = populationData[lsoaItem.LSOA_2011.S]

    if (matchingLsoa != undefined){
      return tableInfo.push({
        ...lsoaItem,
        ...matchingLsoa,
        checked: false
      })
    }
  })

  return tableInfo;
}
