import {
  checkDynamoTable
} from './helper/insertRecords'
const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event, context) => {

  //handshake if true, step in
  //  getMessage is >0, step in

  try { //final output = store in dynamo
    return responseObject;
  } //Stretch goal: create cloudwatch alarm when feed processing fails
  catch (e) {
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject;
  }
};


const checkIcbCode = checkDynamoTable(dbClient, primaryCareProviderCode, "GpPractice", "primaryCareProviderCode", false)
const checkSupersededByNhsNo = checkDynamoTable(dbClient, supersededByNhsNo, "Population", "supersededByNhsNo", true)
const checkNhsNo = checkDynamoTable(dbClient, nhsNo, "Population", "nhsNo", true)
