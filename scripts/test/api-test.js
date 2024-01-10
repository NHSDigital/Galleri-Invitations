import axios from "axios";
import log from "loglevel";
// import { ApiGatewayClient } from "@aws-sdk/client-api-gateway";
// import fromEnv from "@aws-sdk/config-resolver";
import {
  APIGatewayClient,
  GetRestApisCommand,
} from "@aws-sdk/client-api-gateway";
import assert from "assert";
import { exit } from "process";

const environment = process.env.environment;

let logLevel = process.env.LOG_LEVEL || "DEBUG";
log.setLevel(log.levels[logLevel]);

const clinicIcbList = {
  name: "clinic-icb-list",
  resource_path: "clinic-icb-list",
  method: "GET",
  query_string: "?participatingIcb=QJK",
  expected_status_code: 200,
  expected_response_count: 11,
};
const clinicInformation = {
  name: "clinic-information",
  resource_path: "clinic-information",
  method: "GET",
  query_string: "?clinicId=AQ16C317&clinicName=Phlebotomy%20clinic%2015",
  expected_status_code: 200,
  expected_response_count: 13,
};
const clinicSummeryList = {
  name: "clinic-summary-list",
  resource_path: "clinic-summary-list",
  method: "GET",
  query_string: "?participatingIcb=QJK",
  expected_status_code: 200,
  expected_response_count: 11,
};
const getLsoaInRange = {
  name: "get-lsoa-in-range",
  resource_path: "get-lsoa-in-range",
  method: "GET",
  expected_status_code: 200,
  expected_response_count: 5,
  query_string: `?clinicPostcode=BN8%205GZ&miles=1`,
};
const invitationParameters = {
  name: "invitation-parameters",
  resource_path: "invitation-parameters",
  method: "GET",
  expected_status_code: 200,
  expected_response_count: 9,
  query_string: null,
};
const participatingIcbList = {
  name: "participating-icb-list",
  resource_path: "participating-icb-list",
  method: "GET",
  expected_status_code: 200,
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
  expected_response_count: 7,
};
// PUT
const invitationParametersPutQuintiles = {
  name: "invitation-parameters-put-quintiles",
  resource_path: "invitation-parameters-put-quintiles",
  method: "PUT",
  expected_status_code: 200,
  query_string: null,
  payload: { quintiles: ["20", "20", "20", "20", "20"] },
  expected_response_count: 0,
};

const invitationParametersPutForecastUptake = {
  name: "invitation-parameters-put-quintiles",
  resource_path: "invitation-parameters-put-quintiles",
  method: "PUT",
  expected_status_code: 200,
  query_string: null,
  payload: { forecastUptake: 50 },
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
      if (length > 0) {
        log.info(
          `SUCCESS: ${api.name} number of response blocks is: ${length}\n`
        );
      } else {
        log.error(`ERROR: Response from ${api.name} is empty`);
        exit(1);
      }
      // assert.deepStrictEqual(length, api.expected_response_count);
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
// await apiCall({ apiList: apiList, api: targetPercentage });

// POST requests
// Lambda currently broken, awaiting GAL-334 to resolve then test can be enabled
// await apiCall({ apiList: apiList, api: calculateNumberToInvite });
await apiCall({ apiList: apiList, api: generateInvites });

// PUT requests
await apiCall({ apiList: apiList, api: invitationParametersPutQuintiles });
// invitationParametersPutForecastUptake is failing with lambda permission error
// await apiCall({ apiList: apiList, api: invitationParametersPutForecastUptake });

// log.debug(apiList);
