import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import axios from "axios";

/*
  Lambda to get LSOA in a 100 mile range from the selected clinic
*/
export const handler = async (event, context) => {
  const start = Date.now();
  console.log(
    "*************\n Event = " + JSON.stringify(event, null, 2) + "\n**********"
  );
  // destructure event to get the postcode from front end
  // const clinicPostcode = event.queryStringParameters.clinicPostcode;
  // placeholder postcode
  const clinicPostcode = "AL1  1AG";

  // make API request to get the easting and northing of postcode
  const clinicGridReference = await getClinicEastingNorthing(clinicPostcode);
  console.log("clinicGridReference EASTING = ", clinicGridReference.easting);
  console.log("clinicGridReference NORTHING = ", clinicGridReference.northing);

  // need to get all the LSOAs -> return LSOA_2011, EASTING_1M, NORTHING_1M, IMD_DECILE, FORECAST_UPTAKE
  const client = new DynamoDBClient({ region: "eu-west-2" });

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

  const command = new ScanCommand(input);
  const response = await client.send(command);

  console.log("Logging response: ", response?.Items?.length);
  const complete = start - Date.now();
  console.log("Lambda path completion took: ", complete / 1000);

  return response.$metadata.httpStatusCode;
};

async function getClinicEastingNorthing(postcode) {
  const start = Date.now();
  try {
    const postcodeData = await axios.get(
      `https://api.postcodes.io/postcodes/${postcode}`
    );
    const requestStatus = postcodeData.status;
    const postcodeEasting = postcodeData.result?.easting;
    const postcodeNorthing = postcodeData.result?.northing;

    if (postcodeEasting && postcodeNorthing) {
      const complete = start - Date.now();
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
    const complete = start - Date.now();
    console.log(
      "UNSUCCESSFUL completion of getClinicEastingNorthing took: ",
      complete / 1000
    );
    console.error("Error when trying to retrieve postcode grid reference: ");
  }
}
