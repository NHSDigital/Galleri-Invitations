import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";

const KMTOMILES = 1.6;
const MTOKM = 1000;

/*
  Lambda to get LSOA in a 100 mile range from the selected clinic
*/
export const handler = async (event, context) => {
  const start = Date.now();
  // console.log(
  //   "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  // );
  // destructure event to get the postcode from front end
  // const clinicPostcode = event.queryStringParameters.clinicPostcode;
  // placeholder postcode
  const clinicPostcode = "AL1  1AG";

  // make API request to get the easting and northing of postcode
  const clinicGridReference = await getClinicEastingNorthing(clinicPostcode);

  const client = new DynamoDBClient({ region: "eu-west-2" });

  // const input = {
  //   ExpressionAttributeNames: {
  //     "#LC": "LSOA_2011",
  //     "#ET": "EASTING_1M",
  //     "#NT": "NORTHING_1M",
  //     "#ID": "IMD_DECILE",
  //     "#FU": "FORECAST_UPTAKE",
  //   },
  //   ProjectionExpression: "#LC, #ET, #NT, #ID, #FU",
  //   TableName: "UniqueLsoa",
  // };

  // const command = new ScanCommand(input);
  // const response = await client.send(command);

  // console.log("Response = ", JSON.stringify(response, null, 2))
  // var tableItems = []
  // let lastEvaluatedItem = {}
  // await scanLsoaTable(client, lastEvaluatedItem)


  const records = await populateLsoaArray();
  console.log(`Total records from dynamoDB = ${records.length}`);

  const filterRecords = records.filter((lsoaRecord) => {
    const distanceToSiteMiles = calculateDistance(lsoaRecord, clinicGridReference);
    if (distanceToSiteMiles <= 100) {
      // attach to record
      lsoaRecord.DISTANCE_TO_SITE = {
        N: JSON.stringify(Math.round(distanceToSiteMiles * 100) / 100)
      };
      return lsoaRecord;
    }
  });

  console.log("filterRecords length = ", filterRecords.length);

  let responseObject = {};

  if (records.length > 17000) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }),
      (responseObject.body = JSON.stringify(filterRecords));
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
async function getClinicEastingNorthing(postcode) {
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
    console.log(
      "UNSUCCESSFUL completion of getClinicEastingNorthing took: ",
      complete / 1000
    );
    console.error("Error when trying to retrieve postcode grid reference: ");
  }
}

async function scanLsoaTable(client, lastEvaluatedItem) {
  const input = {
    ExpressionAttributeNames: {
      "#LC": "LSOA_2011",
      "#ET": "EASTING_1M",
      "#NT": "NORTHING_1M",
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
    if (response.$metadata.httpStatusCode){
      console.log("Total segments = " + response?.TotalSegments + ". Current segment = " + response?.Segment)
      tableItems.push(response.Items)
      lastEvaluatedItem = response.LastEvaluatedKey
      scanLsoaTable(client, lastEvaluatedItem)
    } else {
      console.log(response)
      console.error("Response from table encountered an error")
    }
  } else {
    scanLsoaTable(client, lastEvaluatedItem)
    return `UniqueLsoa table scanned. Returning ${tableItems.length} records`
  }
}

async function populateLsoaArray(){
  var tableItems = []
  let lastEvaluatedItem = {}
  await scanLsoaTable(client, lastEvaluatedItem)
  return tableItems.flat()
}

const calculateDistance = (lsoa, clinicGridReference) => {
  // get the easting and northing from clinic
  const clinicEasting = Number(clinicGridReference.easting);
  const clinicNorthing = Number(clinicGridReference.northing);

  // get the easting and northing from lsoa
  const lsoaEasting = Number(lsoa.EASTING_1M.N);
  const lsoaNorthing = Number(lsoa.NORTHING_1M.N);

  // console.log(`clinicEasting = ${clinicEasting} clinicNorthing = ${clinicNorthing} | lsoaEasting ${lsoaEasting} lsoaNorthing = ${lsoaNorthing}`)

  // calculate straight line distance
  const distanceMiles =
    Math.sqrt(
      Math.pow(Math.abs(clinicEasting - lsoaEasting), 2) +
      Math.pow(Math.abs(clinicNorthing - lsoaNorthing), 2)
    )/
    (MTOKM * KMTOMILES);

  return distanceMiles;
};
