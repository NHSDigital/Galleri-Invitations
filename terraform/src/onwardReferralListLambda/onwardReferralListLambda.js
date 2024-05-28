import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to load clinic information and pass on to GPS client.
*/
export const handler = async (event, context) => {

  console.log("Entered OnwardReferralList lambda");
  try {
    const participantList = await lookupParticipantsCsd(
      client
    );

    console.log("------participantList-------", JSON.stringify(participantList));

    const participantsInfo = await lookupParticipantsInfo(
      participantList,
      client
    );

    let responseObject = {};

    if (participantsInfo.hasOwnProperty("Items")) {
      responseObject.statusCode = 200;
      responseObject.isBase64Encoded = true;
      responseObject.headers = {
        "Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      };
      responseObject.body = JSON.stringify(participantsInfo.Items);
    } else {
      responseObject.statusCode = 404;
      responseObject.headers = {
        "Access-Control-Allow-Headers":
          "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS,GET",
      };
      responseObject.isBase64Encoded = true;
      responseObject.body = "error";
    }

    console.log("------responseObject-------", JSON.stringify(responseObject));
    return responseObject;

  } catch (error) {
    console.log("Error occured in OnwardReferralList lambda");
    console.error(`Error: ${error}`);
  }

};

// look into episode table and see which participants have latest result as CSD
export const lookupParticipantsCsd = async (client) => {
  console.log("Entered function lookupParticipantsCsd");

  try {
    const cancerSignalDetected = "Result - CSD";

    const input = {
      ExpressionAttributeValues: {
        ":a": {
          S: `${cancerSignalDetected}`,
        }
      },
      FilterExpression: "Episode_Event = :a",
      ProjectionExpression: "Participant_Id",
      TableName: `${ENVIRONMENT}-Episode`,
      IndexName: "Episode_Event-index"
    };

    const command = new QueryCommand(input);
    const response = await client.send(command);

    console.log("Exiting function lookupParticipantsCsd");
    return response.Items;
  } catch (error) {
    console.log("Error in lookupParticipantsCsd");
    throw error;
  }

};

export const lookupParticipantsInfo = async (participantList, client) => {
  console.log("Entered function lookupParticipantsInfo");

  try {
    const input = {
      ExpressionAttributeNames: {
        "#PI": "Participant_Id",
        "#BDD": "Blood_Draw_Date",
        "#RC": "Result_Creation",
        "#PN": "Participant_Name",
      },
      ExpressionAttributeValues: participantList,
      FilterExpression: "Participant_Id IN (" + Object.keys(participantList).toString() + ")",
      ProjectionExpression: "#PI, #BDD, #RC, #PN",
      TableName: `${ENVIRONMENT}-GalleriBloodTestResult`,
    };

    const command = new ScanCommand(input);
    const response = await client.send(command);

    console.log("Exiting function lookupParticipantsInfo");
    return response;
  } catch (error) {
    console.log("Error in lookupParticipantsInfo");
    throw error;
  }

};
