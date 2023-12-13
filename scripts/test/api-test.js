import axios from "axios";
import log from "loglevel";
// import { ApiGatewayClient } from "@aws-sdk/client-api-gateway";
// import fromEnv from "@aws-sdk/config-resolver";
import {
  APIGatewayClient,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import assert from "assert";

const environment = process.env.environment;

let logLevel = process.env.LOG_LEVEL || "DEBUG";
log.setLevel(log.levels[logLevel]);

const clinicIcbList = {
  name: "clinic-icb-list",
  resource_path: "clinic-icb-list",
  method: "GET",
  query_string: "?participatingIcb=QJK",
  expected_status_code: 200,
  expected_response: [
    {
      ClinicId: { S: "EJ00T386" },
      ClinicName: { S: "Phlebotomy clinic 3" },
    },
    {
      ClinicId: { S: "YJ20Y942" },
      ClinicName: { S: "Phlebotomy clinic 32" },
    },
    {
      ClinicId: { S: "OR09A834" },
      ClinicName: { S: "Phlebotomy clinic 73" },
    },
    {
      ClinicId: { S: "FN27A988" },
      ClinicName: { S: "Phlebotomy clinic 49" },
    },
    {
      ClinicId: { S: "OC99R750" },
      ClinicName: { S: "Phlebotomy clinic 63" },
    },
    {
      ClinicId: { S: "WT49A298" },
      ClinicName: { S: "Phlebotomy clinic 71" },
    },
    {
      ClinicId: { S: "CJ03Q050" },
      ClinicName: { S: "Phlebotomy clinic 12" },
    },
    {
      ClinicId: { S: "EP25G193" },
      ClinicName: { S: "Phlebotomy clinic 86" },
    },
    {
      ClinicId: { S: "WF19P693" },
      ClinicName: { S: "Phlebotomy clinic 72" },
    },
    {
      ClinicId: { S: "YE87F427" },
      ClinicName: { S: "Phlebotomy clinic 21" },
    },
    {
      ClinicId: { S: "QQ67R985" },
      ClinicName: { S: "Phlebotomy clinic 8" },
    },
  ],
  expected_response_count: 11,
};
const clinicInformation = {
  name: "clinic-information",
  resource_path: "clinic-information",
  method: "GET",
  query_string: "?clinicId=QZ13U367&clinicName=Phlebotomy%20clinic%2057",
  expected_status_code: 200,
  expected_response: {
    Availability: { N: "185" },
    Address: { S: "57 reductionist Street ,             Mordor JP0 8ZR" },
    Directions: { S: "These will contain directions to the site" },
    ODSCode: { S: "P72146" },
    ClinicId: { S: "QZ13U367" },
    InvitesSent: { N: "92" },
    ICBCode: { S: "QF7" },
    LastSelectedRange: { N: "1" },
    TargetFillToPercentage: { N: "50" },
    PostCode: { S: "JP0 8ZR" },
    PrevInviteDate: { S: "Saturday 11 November 2023" },
    ClinicName: { S: "Phlebotomy clinic 57" },
    WeekCommencingDate: {
      M: {
        "11 January 2024": { N: "33" },
        "21 December 2023": { N: "1" },
        "28 December 2023": { N: "57" },
        "4 January 2024": { N: "49" },
        "14 December 2023": { N: "19" },
        "18 January 2024": { N: "26" },
      },
    },
  },
  expected_response_count: 13,
};
const clinicSummeryList = {
  name: "clinic-summary-list",
  resource_path: "clinic-summary-list",
  method: "GET",
  query_string: "?participatingIcb=QJK",
  expected_status_code: 200,
  expected_response: [
    {
      Availability: { N: "306" },
      ClinicId: { S: "EJ00T386" },
      InvitesSent: { N: "203" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Wednesday 6 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 3" },
    },
    {
      Availability: { N: "301" },
      ClinicId: { S: "YJ20Y942" },
      InvitesSent: { N: "1" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Friday 1 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 32" },
    },
    {
      Availability: { N: "10" },
      ClinicId: { S: "OR09A834" },
      InvitesSent: { N: "100" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Monday 1 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 73" },
    },
    {
      Availability: { N: "960" },
      ClinicId: { S: "FN27A988" },
      InvitesSent: { N: "9" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Monday 4 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 49" },
    },
    {
      Availability: { N: "355" },
      ClinicId: { S: "OC99R750" },
      InvitesSent: { N: "338" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Wednesday 6 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 63" },
    },
    {
      Availability: { N: "104" },
      ClinicId: { S: "WT49A298" },
      InvitesSent: { N: "539" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Tuesday 5 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 71" },
    },
    {
      Availability: { N: "323" },
      ClinicId: { S: "CJ03Q050" },
      InvitesSent: { N: "5" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Monday 4 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 12" },
    },
    {
      Availability: { N: "348" },
      ClinicId: { S: "EP25G193" },
      InvitesSent: { N: "233" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Wednesday 6 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 86" },
    },
    {
      Availability: { N: "247" },
      ClinicId: { S: "WF19P693" },
      InvitesSent: { N: "123" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Saturday 11 November 2023" },
      ClinicName: { S: "Phlebotomy clinic 72" },
    },
    {
      Availability: { N: "157" },
      ClinicId: { S: "YE87F427" },
      InvitesSent: { N: "846" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Tuesday 5 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 21" },
    },
    {
      Availability: { N: "193" },
      ClinicId: { S: "QQ67R985" },
      InvitesSent: { N: "108" },
      ICBCode: { S: "QJK" },
      PrevInviteDate: { S: "Tuesday 5 December 2023" },
      ClinicName: { S: "Phlebotomy clinic 8" },
    },
  ],
  expected_response_count: 11,
};
const getLsoaInRange = {
  name: "get-lsoa-in-range",
  resource_path: "get-lsoa-in-range",
  method: "GET",
  expected_status_code: 200,
  expected_response: [
    {
      IMD_DECILE: { N: "5" },
      LSOA_NAME: { S: "Tower Hamlets 026B" },
      LSOA_2011: { S: "E01004294" },
      AVG_NORTHING: { S: "0180599" },
      AVG_EASTING: { S: "534216" },
      FORECAST_UPTAKE: { N: "27" },
      DISTANCE_TO_SITE: { N: "0.91" },
      ELIGIBLE_POPULATION: { S: 41 },
      INVITED_POPULATION: { S: 20 },
    },
    {
      IMD_DECILE: { N: "3" },
      LSOA_NAME: { S: "City of London 001E" },
      LSOA_2011: { S: "E01000005" },
      AVG_NORTHING: { S: "0181139" },
      AVG_EASTING: { S: "533542" },
      FORECAST_UPTAKE: { N: "18" },
      DISTANCE_TO_SITE: { N: "0.82" },
      ELIGIBLE_POPULATION: { S: 26 },
      INVITED_POPULATION: { S: 8 },
    },
    {
      IMD_DECILE: { N: "8" },
      LSOA_NAME: { S: "Tower Hamlets 027B" },
      LSOA_2011: { S: "E01004293" },
      AVG_NORTHING: { S: "0180340" },
      AVG_EASTING: { S: "534037" },
      FORECAST_UPTAKE: { N: "21" },
      DISTANCE_TO_SITE: { N: "0.75" },
      ELIGIBLE_POPULATION: { S: 16 },
      INVITED_POPULATION: { S: 7 },
    },
    {
      IMD_DECILE: { N: "7" },
      LSOA_NAME: { S: "Tower Hamlets 021F" },
      LSOA_2011: { S: "E01032767" },
      AVG_NORTHING: { S: "0181036" },
      AVG_EASTING: { S: "533969" },
      FORECAST_UPTAKE: { N: "16" },
      DISTANCE_TO_SITE: { N: "0.94" },
      ELIGIBLE_POPULATION: { S: 12 },
      INVITED_POPULATION: { S: 4 },
    },
    {
      IMD_DECILE: { N: "7" },
      LSOA_NAME: { S: "City of London 001F" },
      LSOA_2011: { S: "E01032739" },
      AVG_NORTHING: { S: "0180678" },
      AVG_EASTING: { S: "532338" },
      FORECAST_UPTAKE: { N: "23" },
      DISTANCE_TO_SITE: { N: "0.54" },
      ELIGIBLE_POPULATION: { S: 229 },
      INVITED_POPULATION: { S: 118 },
    },
  ],
  expected_response_count: 5,
  query_string: `?clinicPostcode=BN8%205GZ&miles=1`,
};
const invitationParameters = {
  name: "invitation-parameters",
  resource_path: "invitation-parameters",
  method: "GET",
  expected_status_code: 200,
  expected_response: {
    LAST_UPDATE: { S: "2023-11-18 15:55:44.432942" },
    QUINTILE_4: { N: "20" },
    CONFIG_ID: { N: "1" },
    QUINTILE_3: { N: "20" },
    QUINTILE_5: { N: "20" },
    FORECAST_UPTAKE: { N: "50" },
    QUINTILE_2: { N: "20" },
    QUINTILE_1: { N: "20" },
  },
  expected_response_count: 8,
  query_string: null,
};
const participatingIcbList = {
  name: "participating-icb-list",
  resource_path: "participating-icb-list",
  method: "GET",
  expected_status_code: 200,
  expected_response: [
    "QJK",
    "QSL",
    "QE1",
    "QMJ",
    "QF7",
    "QH8",
    "QNX",
    "QMF",
    "QRV",
    "QNQ",
    "QM7",
    "QVV",
    "QOX",
    "QRL",
    "QHG",
    "QU9",
    "QR1",
    "QT6",
    "QXU",
    "QWO",
    "QOQ",
    "QUY",
    "QWE",
  ],
  expected_response_count: 23,
  query_string: null,
};
const targetPercentage = {
  name: "target-percentage",
  resource_path: "target-percentage",
  method: "GET",
  expected_status_code: 200,
  expected_response: {},
  query_string: null,
};
// POST
const calculateNumberToInvite = {
  name: "calculate-num-to-invite",
  resource_path: "calculate-num-to-invite",
  method: "POST",
  expected_status_code: 200,
  expected_response: "test",
  expected_response_count: 2,
  query_string: null,
  payload: {
    targetAppsToFill: 10,
    lsoaCodes: {
      E01000005: {
        IMD_DECILE: "3",
        FORECAST_UPTAKE: "23",
      },
    },
  },
};
const generateInvites = {
  name: "generate-invites",
  resource_path: "generate-invites",
  method: "POST",
  expected_status_code: 200,
  expected_response: "test",
  query_string: "?selectedParticipants=9000211252",
  payload: {
    selectedParticipants: ["9000211252"],
    clinicInfo: {
      clinicId: "CC51F831",
      clinicName: "Phlebotomy clinic 5",
      rangeSelected: 1,
      targetPercentage: "50",
      targetNoAppsToFill: 160,
      appRemaining: "321",
    },
  },
};
// PUT
const invitationParametersPutQuintiles = {
  name: "invitation-parameters-put-quintiles",
  resource_path: "invitation-parameters-put-quintiles",
  method: "PUT",
  expected_status_code: 200,
  expected_response: {
    LAST_UPDATE: { S: "2023-11-18 15:55:44.432942" },
    QUINTILE_4: { N: "20" },
    CONFIG_ID: { N: "1" },
    QUINTILE_3: { N: "20" },
    QUINTILE_5: { N: "20" },
    FORECAST_UPTAKE: { N: "50" },
    QUINTILE_2: { N: "20" },
    QUINTILE_1: { N: "20" },
  },
  query_string: null,
  payload: {
    LAST_UPDATE: { S: "2023-11-18 15:55:44.432942" },
    QUINTILE_4: { N: "20" },
    CONFIG_ID: { N: "1" },
    QUINTILE_3: { N: "20" },
    QUINTILE_5: { N: "20" },
    FORECAST_UPTAKE: { N: "50" },
    QUINTILE_2: { N: "20" },
    QUINTILE_1: { N: "20" },
  },
};
const putTargetPercentage = {
  name: "invitation-parameters",
  resource_path: "invitation-parameters",
  method: "PUT",
  expected_status_code: 200,
  expected_response: {
    LAST_UPDATE: { S: "2023-11-18 15:55:44.432942" },
    QUINTILE_4: { N: "20" },
    CONFIG_ID: { N: "1" },
    QUINTILE_3: { N: "20" },
    QUINTILE_5: { N: "20" },
    FORECAST_UPTAKE: { N: "50" },
    QUINTILE_2: { N: "20" },
    QUINTILE_1: { N: "20" },
  },
  query_string: null,
  payload: {
    LAST_UPDATE: { S: "2023-11-18 15:55:44.432942" },
    QUINTILE_4: { N: "20" },
    CONFIG_ID: { N: "1" },
    QUINTILE_3: { N: "20" },
    QUINTILE_5: { N: "20" },
    FORECAST_UPTAKE: { N: "50" },
    QUINTILE_2: { N: "20" },
    QUINTILE_1: { N: "20" },
  },
};

const getApiId = async () => {
  const client = new APIGatewayClient();
  const input = {
    // Default pagination is 25 so overwriting it to get all api's
    limit: Number("100"),
  };

  try {
    // Get a list of APIs
    const command = new GetRestApisCommand(input);
    const response = await client.send(command);
    return response;
  } catch (error) {
    console.error("Error getting the list of APIs: ", error);
    return null;
  }
};

const buildUrl = async ({ apiList, api }) => {
  const apiName = `${environment}-${api.name}`;
  const resourcePath = api.resource_path;
  let apiId = null;

  for (const item of apiList.items) {
    if (item.name === apiName) {
      apiId = item.id;
      break;
    }
  }

  if (apiId) {
    let invokeUrl;
    // Construct the invoke URL
    if (api.query_string) {
      invokeUrl = `https://${apiId}.execute-api.eu-west-2.amazonaws.com/${environment}/${resourcePath}${api.query_string}`;
    } else {
      invokeUrl = `https://${apiId}.execute-api.eu-west-2.amazonaws.com/${environment}/${resourcePath}`;
    }
    return invokeUrl;
  } else {
    console.log(`API with the name ${apiName} was not found.`);
    return null;
  }
};

async function apiCall({ apiList, api }) {
  const fullUrl = await buildUrl({ apiList: apiList, api: api });
  let response;
  try {
    if (api.method === "GET") {
      response = await axios.get(fullUrl);
    } else if (api.method === "POST") {
      response = await axios.post(fullUrl, api.payload);
    } else if (api.method === "PUT") {
      response = await axios.put(fullUrl, api.payload);
    }

    // log.debug(response.data);
    assert.deepStrictEqual(response.status, api.expected_status_code);
    log.info(`SUCCESS: ${api.name} responded with status ${response.status}`);
    if (api.expected_response_count) {
      const length = Object.keys(response.data).length;
      assert.deepStrictEqual(length, api.expected_response_count);
      log.info(`SUCCESS: ${api.name} number of response blocks is: ${length}`);
    }
    return response;
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

const apiList = await getApiId();
// GET requests
await apiCall({ apiList: apiList, api: clinicIcbList });
await apiCall({ apiList: apiList, api: clinicInformation });
await apiCall({ apiList: apiList, api: clinicSummeryList });
await apiCall({ apiList: apiList, api: getLsoaInRange });
await apiCall({ apiList: apiList, api: participatingIcbList });
await apiCall({ apiList: apiList, api: invitationParameters });
// Target Percentage currently unused
await apiCall({ apiList: apiList, api: targetPercentage });

// POST requests
await apiCall({ apiList: apiList, api: calculateNumberToInvite });
// await apiCall({ apiList: apiList, api: generateInvites });

// PUT requests
// await apiCall({ apiList: apiList, api: invitationParametersPutQuintiles });
// await apiCall({ apiList: apiList, api: putTargetPercentage });

// log.debug(apiList);
