import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";

/*
  Lambda to get LSOA in a 100 mile range from the selected clinic
*/
export const handler = async (event, context) => {
  console.log(
    "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  );

  const client = new DynamoDBClient({ region: "eu-west-2" });

  const clinicPostcode = event.queryStringParameters.clinicPostcode;

  // make call to get the postcode easting and northing
  const clinicGridReference = getEastingNorthing(clinicPostcode);

  // get the average northing and farthing for every LSOA

  // const clinicName = event.queryStringParameters.clinicName;

  const input = {
    ExpressionAttributeNames: {
      "#PC": "POSTCODE",
      "#ET": "EASTING_1M",
      "#NT": "NORTHING_1M",
      "#IC": "ICB",
      "#ID": "IMD_DECILE",
      "#LC": "LSOA_2011",
    },
    ExpressionAttributeValues: {
      ":a": {
        S: `${participatingIcbSelection}`,
      },
    },
    FilterExpression: "ICBCode = :a",
    ProjectionExpression: "#PC, #ET, #NT, #IC, #ID, #LC",
    TableName: "Lsoa",
  };

  const command = new ScanCommand(input);
  const response = await client.send(command);

  let responseObject = {};

  if (response.hasOwnProperty("Item")) {
    responseObject.statusCode = 200;
    (responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }),
      (responseObject.isBase64Encoded = true);
    responseObject.body = JSON.stringify(response.Item);
  } else {
    responseObject.statusCode = 404;
    responseObject.isBase64Encoded = true;
    responseObject.body = "error";
  }

  return responseObject;
};

async function getEastingNorthing(postcode) {
  try {
    const postcodeData = await axios.get(
      `https://api.postcodes.io/postcodes/${postcode}`
    );
    const postcodeEasting = postcodeData.data?.easting;
    const postcodeNorthing = postcodeData.data?.northing;

    if (postcodeEasting && postcodeNorthing) {
      return {
        easting: postcodeEasting,
        northing: postcodeNorthing,
      };
    } else {
      throw new Error("Grid coordinates not returned by api");
    }
  } catch (e) {
    console.error("Error when trying to retrieve postcode grid reference: ");
  }
}
