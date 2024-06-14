import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import axios from "axios";

const ENVIRONMENT = process.env.ENVIRONMENT;

const KMTOMILES = 1.6;
const MTOKM = 1000;

/**
 * Lambda to get LSOA in a 100 mile range from the selected clinic
 *
 * @async
 * @function handler
 * @param {Object} event Api gateway lambda proxy request object
 * @param {Object} context Lambda context
 * @returns {Object} Api gateway response object
 */
export const handler = async (event, context) => {
  const start = Date.now();
  // CALCULATE DISTANCE BETWEEN SITE AND LSOAs. RETURN THOSE IN 100 MILE RANGE

  // TODO: when accurate clinic data recieved then remove placeholder
  let clinicPostcode = event.queryStringParameters.clinicPostcode;
  // Placeholder
  //clinicPostcode = "SE1 9RT";
  console.log("Clinic postcode: ", clinicPostcode);
  const lsoasInRangeMiles = event.queryStringParameters.miles;

  // make API request to get the easting and northing of postcode
  const clinicGridReference = await getClinicEastingNorthing(clinicPostcode);

  const dynamoDbclient = new DynamoDBClient({ region: "eu-west-2" });

  const records = await populateLsoaArray(dynamoDbclient);
  console.log(`Total records from dynamoDB = ${records.length}`);

  const lsoaCodePayload = [];
  const within = [];
  const filterLsoaRecords = records.filter((lsoaRecord) => {
    const distanceToSiteMiles = calculateDistance(
      lsoaRecord,
      clinicGridReference
    );

    if (distanceToSiteMiles <= lsoasInRangeMiles) {
      // attach to record
      lsoaRecord.DISTANCE_TO_SITE = {
        N: JSON.stringify(Math.round(distanceToSiteMiles * 100) / 100),
      };
      lsoaCodePayload.push(lsoaRecord.LSOA_2011);
      within.push({
        LSOA_NAME: lsoaRecord.LSOA_NAME.S,
        DISTANCE: distanceToSiteMiles,
      });
      return lsoaRecord;
    }
  });

  console.log("In range ", JSON.stringify(within));
  console.log("filterRecords length = ", filterLsoaRecords.length);

  // FIND THE PARTICIPANTS IN THOSE LSOAs AND COMBINE THE RESPECTIVE ARRAYS
  const lambdaClient = new LambdaClient({ region: "eu-west-2" });

  const triggerLambda = Date.now();
  console.log(
    "Invoking getLsoaParticipantsLambda to get eligible and invited participants"
  );
  const input = {
    FunctionName: `${ENVIRONMENT}-getLsoaParticipantsLambda`,
    Payload: JSON.stringify(lsoaCodePayload),
  };
  const command = new InvokeCommand(input);
  const response = await lambdaClient.send(command);
  console.log(
    "Lambda invoke completed. Took: ",
    (Date.now() - triggerLambda) / 1000
  );

  const participantInLsoa = JSON.parse(
    Buffer.from(response.Payload).toString()
  );

  const combinedLsoaParticipants = generateLsoaTableData(
    filterLsoaRecords,
    participantInLsoa
  );

  console.log("combinedLsoaParticipants = ", combinedLsoaParticipants.length);

  let responseObject = {};

  if (records.length != 0) {
    responseObject.statusCode = 200;
    responseObject.isBase64Encoded = true;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.body = JSON.stringify(combinedLsoaParticipants);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }),
      (responseObject.body = "error");
  }

  const complete = Date.now() - start;
  console.log("Lambda path completion took: ", complete / 1000);
  return responseObject;
};

// METHODS
/**
 * Calculates a postcode's northing and easting values.
 *
 * @async
 * @function getClinicEastingNorthing
 * @param {string} postcode Postcode value
 * @returns {Object} Object containing the northing and easting
 */
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
      console.log("Success");
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
    console.log("Unsuccess");
    console.log(
      "UNSUCCESSFUL completion of getClinicEastingNorthing took: ",
      complete / 1000
    );
    console.error("Error when trying to retrieve postcode grid reference ");
  }
}

/**
 * Recursively scans and retrieves all records from the UniqueLsoa table.
 *
 * @async
 * @function scanLsoaTable
 * @param {DynamoDBClient} client Dynamodb client
 * @param {Object} lastEvaluatedItem Previous result set's last record's primary key
 * @param {Array} tableItems Array to which records are added
 * @returns {Promise<string>} Promise resolving to success message
 */
export async function scanLsoaTable(client, lastEvaluatedItem, tableItems) {
  const input = {
    ExpressionAttributeNames: {
      "#LC": "LSOA_2011",
      "#ET": "AVG_EASTING",
      "#NT": "AVG_NORTHING",
      "#ID": "IMD_DECILE",
      "#MO": "MODERATOR",
      "#LN": "LSOA_NAME",
    },
    ProjectionExpression: "#LC, #ET, #NT, #ID, #MO, #LN",
    TableName: `${ENVIRONMENT}-UniqueLsoa`,
  };
  if (Object.keys(lastEvaluatedItem).length != 0) {
    input.ExclusiveStartKey = lastEvaluatedItem;
  }

  const command = new ScanCommand(input);
  const response = await client.send(command);

  if (response.LastEvaluatedKey) {
    if (response.$metadata.httpStatusCode == 200) {
      console.log(
        "Table is larger than 1Mb hence recursively routing through to obtain all data"
      );
      tableItems.push(response.Items);
      lastEvaluatedItem = response.LastEvaluatedKey;
      await scanLsoaTable(client, lastEvaluatedItem, tableItems);
    } else {
      console.log("Unsuccess");
      console.error("Response from table encountered an error");
    }
  } else {
    // run last invocation
    console.log("at last bit");
    input.ExclusiveStartKey = lastEvaluatedItem;
    const command = new ScanCommand(input);
    const response = await client.send(command);

    if (response.$metadata.httpStatusCode == 200) {
      tableItems.push(response.Items);
      return `UniqueLsoa table scanned. Returning ${tableItems.length} records`;
    } else {
      console.error("Something went wrong with last request");
    }
  }
}

/**
 * Gets array of all lsoa records.
 *
 * @async
 * @function populateLsoaArray
 * @param {DynamoDBClient} client Dynamodb client
 * @returns {Promise<Array<Object>>} Promise resolving to array of lsoa records
 */
async function populateLsoaArray(client) {
  const tableItems = [];
  let lastEvaluatedItem = {};
  await scanLsoaTable(client, lastEvaluatedItem, tableItems);
  return tableItems.flat();
}

/**
 * Calculates the distance between an lsoa and a clinic.
 *
 * @function calculateDistance
 * @param {Object} lsoa Object with an lsoa's northing and easting
 * @param {Object} clinicGridReference Object with a clinic's northing and easting
 * @returns {number} Distance in miles
 */
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
    ) /
    (MTOKM * KMTOMILES);

  return distanceMiles;
};

/**
 * Combines each lsoa with its elligible and invited population counts.
 *
 * @function generateLsoaTableData
 * @param {Array<Object>} lsoaData Array of lsoa records
 * @param {Object} populationData Object with each lsoa's elligible and invited population counts
 * @returns {Array<Object>} Array of objects containing lsoa and population counts data
 */
export function generateLsoaTableData(lsoaData, populationData) {
  const tableInfo = [];
  console.log(
    `lsoaData.length = ${lsoaData.length}| populationData.length = ${
      Object.keys(populationData).length
    }`
  );

  lsoaData.forEach((lsoaItem) => {
    const matchingLsoa = populationData[lsoaItem.LSOA_2011.S];

    if (matchingLsoa != undefined) {
      return tableInfo.push({
        ...lsoaItem,
        ...matchingLsoa,
      });
    }
  });

  return tableInfo;
}
