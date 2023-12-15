import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";

import uuid4 from "uuid4";

const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event, context) => {
  const eventJson = JSON.parse(event.body);
  const personIdentifiedArray = eventJson.selectedParticipants;
  const clinicInfo = eventJson.clinicInfo;

  let responseObject = {
    headers: {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    isBase64Encoded: true,
  };

  try {
    let personUpdated = false;
    let siteUpdated = false;

    const responsePopulation = await updatePersonsToBeInvited(
      personIdentifiedArray,
      client
    );
    const responsePhlebotomySite = await updateClinicFields(
      clinicInfo,
      personIdentifiedArray.length,
      client
    );

    const SUCCESSFULL_REPSONSE = 200;

    if (
      responsePopulation.every(
        (element) => element.value === SUCCESSFULL_REPSONSE
      )
    ) {
      console.log(`All ${responsePopulation.length} persons successfully updated`);
      personUpdated = true;
    }

    if (responsePhlebotomySite == SUCCESSFULL_REPSONSE) {
      console.log("Site successfully updated");
      siteUpdated = true;
    }

    if (siteUpdated && personUpdated) {
      responseObject.statusCode = 200;
      responseObject.body = "Success";

      return responseObject;
    } else {
      throw new Error(`Action to update Population was successful? ${personUpdated}
        Action to update PhlebotomySite was successful? ${siteUpdated}`);
    }
  } catch (e) {
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject;
  }
};

//METHODS

export async function updatePersonsToBeInvited(recordArray, client) {
  // create a batch id
  // assign it to records array
  const batchId = await generateBatchID();
  console.log(`batchId = ${batchId}`)

  const validParticipants = recordArray.filter((record) => {
    return record !== null;
  });
  return Promise.allSettled(
    validParticipants.map(async (record) => {
      return updateRecord(record, batchId, client);
    })
  );
}

// Takes single record and update that individual to have a identifiedToBeInvited field = true
// export async function updateRecord(record, client) {
export async function updateRecord(record, batchId, client) {
  const lsoaCodeReturn = await getLsoaCode(record, client);
  const items = lsoaCodeReturn.Items;
  const lsoaCode = items[0].LsoaCode.S;

  const input = {
    ExpressionAttributeNames: {
      "#IDENTIFIED_TO_BE_UPDATED": "identified_to_be_invited",
      "#BATCH_ID": "Batch_Id"
    },
    ExpressionAttributeValues: {
      ":to_be_invited": {
        BOOL: true,
      },
      ":batch": {
        S: `${batchId}`,
      },
    },
    Key: {
      PersonId: {
        S: `${record}`,
      },
      LsoaCode: {
        S: `${lsoaCode}`,
      },
    },
    TableName: `${ENVIRONMENT}-Population`,
    UpdateExpression: `SET
      #IDENTIFIED_TO_BE_UPDATED = :to_be_invited,
      #BATCH_ID = :batch`,
  };

  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  if ((response.$metadata.httpStatusCode) != 200){
    console.log(`updateRecord RESPONSE = ${response}`)
  }
  return response.$metadata.httpStatusCode;
}

export async function getLsoaCode(record, client) {
  const input = {
    ExpressionAttributeValues: {
      ":person": {
        S: `${record}`,
      },
    },
    KeyConditionExpression: "PersonId = :person",
    ProjectionExpression: "LsoaCode",
    TableName: `${ENVIRONMENT}-Population`,
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  return response;
}




export async function updateClinicFields(clinicInfo, invitesSent, client) {
  const {
    clinicId,
    clinicName,
    rangeSelected,
    targetPercentage,
    targetNoAppsToFill,
    appRemaining,
  } = clinicInfo;

  const newAvailability = Number(appRemaining) - Number(targetNoAppsToFill);

  const date = new Date(Date.now());
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const formattedDate = date
    .toLocaleDateString("en-GB", options)
    .replace(/,/g, "");

  const input = {
    ExpressionAttributeNames: {
      "#TARGET_FILL": "TargetFillToPercentage",
      "#RANGE": "LastSelectedRange",
      "#INVITE_DATE": "PrevInviteDate",
      "#INVITE_SENT": "InvitesSent",
      "#AVAILABILITY": "Availability",
    },
    ExpressionAttributeValues: {
      ":targetPercentage": {
        N: `${targetPercentage}`,
      },
      ":rangeSelected": {
        N: `${rangeSelected}`,
      },
      ":inviteDate": {
        S: `${formattedDate}`,
      },
      ":inviteSent": {
        N: `${invitesSent}`,
      },
      ":availability": {
        N: `${newAvailability}`,
      },
    },
    Key: {
      ClinicId: {
        S: `${clinicId}`,
      },
      ClinicName: {
        S: `${clinicName}`,
      },
    },
    TableName: `${ENVIRONMENT}-PhlebotomySite`,
    UpdateExpression: `SET
        #TARGET_FILL = :targetPercentage,
        #RANGE = :rangeSelected,
        #INVITE_DATE = :inviteDate,
        #INVITE_SENT = :inviteSent,
        #AVAILABILITY = :availability`,
  };
  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  return response.$metadata.httpStatusCode;
}

export const generateBatchID = async () => {
  try {
    const batchUuid = uuid4()
    const batchId = `IB-${batchUuid}`
    let found = 400;
    do {
      console.log("In generateBatchID. Checking if batchId exists in Episode table")
      found = await lookupBatchId(batchId, `Population`);
      console.log("found: ", found)
    } while (found == 400);
    return batchId;
  } catch (err) {
    console.error("Error generating batch id.");
    console.error(err);
    return err;
  }
};

// ensure no duplicate participantIds
const lookupBatchId = async (batchId, table) => {
  console.log("in lookupBatchId")
  const input = {
    ExpressionAttributeValues: {
      ":batch": {
        S: `${batchId}`,
      },
    },
    KeyConditionExpression: "Batch_Id = :batch",
    ProjectionExpression: "Batch_Id",
    TableName: `${ENVIRONMENT}-${table}`,
    IndexName: "BatchId-index",
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);
  console.log("lookupBatchId Response = ", JSON.stringify(response))
  if (!response.Items.length){ // if response is empty, no matching participantId
    return 200
  }
  return 400;
};
