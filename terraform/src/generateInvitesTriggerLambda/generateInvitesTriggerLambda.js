import { DynamoDBClient, UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.environment;


export const handler = async (event, context) => {
  const eventJson = JSON.parse(event.body);
  const personIdentifiedArray = eventJson.selectedParticipants;
  const clinicInfo = eventJson.clinicInfo;

  let responseObject = {
    "headers": {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    "isBase64Encoded": true
  };

  try {
    let personUpdated = false;
    let siteUpdated = false;

    const responsePopulation = await updatePersonsToBeInvited(personIdentifiedArray, client)
    const responsePhlebotomySite = await updateClinicFields(clinicInfo, client)

    const SUCCESSFULL_REPSONSE = 200

    if (responsePopulation.every(element => element.value === SUCCESSFULL_REPSONSE)){
      console.log("All persons successfully updated")
      personUpdated = true;
    }

    if (responsePhlebotomySite == SUCCESSFULL_REPSONSE){
      console.log("Site successfully updated")
      siteUpdated = true;
    }

    if (siteUpdated && personUpdated){
      responseObject.statusCode = 200;
      responseObject.body = "Success";

      return responseObject;
    } else {
      throw new Error(`Action to update Population was successful? ${personUpdated}\nAction to update PhlebotomySite was successful? ${siteUpdated}`);
    }
  } catch(e){
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject;
  }
};

//METHODS
export async function getLsoaCode(record, client){
  const input = {
    "ExpressionAttributeValues": {
      ":person": {
        "S": `${record}`
      }
    },
    "KeyConditionExpression": "PersonId = :person",
    "ProjectionExpression": "LsoaCode",
    "TableName": `${ENVIRONMENT}-Population`,
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  return response
}

// Takes single record and update that individual to have a identifiedToBeInvited field = true
export async function updateRecord(record, client){
  const lsoaCodeReturn = await getLsoaCode(record, client);
  const items = lsoaCodeReturn.Items
  const lsoaCode = items[0].LsoaCode.S

  const input = {
    "ExpressionAttributeNames": {
      "#IDENTIFIED_TO_BE_UPDATED": "identified_to_be_invited"
    },
    "ExpressionAttributeValues": {
      ":to_be_invited": {
        "BOOL": true,
      },
    },
    "Key": {
      "PersonId": {
        "S": `${record}`,
      },
      "LsoaCode": {
        "S": `${lsoaCode}`
      }
    },
    "TableName": `${ENVIRONMENT}-Population`,
    "UpdateExpression": "SET #IDENTIFIED_TO_BE_UPDATED = :to_be_invited"
  };

  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  return response.$metadata.httpStatusCode;
}

export async function updatePersonsToBeInvited(recordArray, client){
  const validParticipants = recordArray.filter((record) => {
    return record !== null
  })
  return Promise.allSettled(
    validParticipants.map(async (record) =>  {
        return updateRecord(record, client)
    })
  );
}


export async function updateClinicFields(clinicInfo, client){
  const { clinicId, clinicName, rangeSelected, targetPercentage } = clinicInfo;
  const input = {
    "ExpressionAttributeNames": {
      "#TARGETFILL": "TargetFillToPercentage",
      "#RANGE": "LastSelectedRange"
    },
    "ExpressionAttributeValues": {
      ":targetPercentage": {
        "N": `${targetPercentage}`,
      },
      ":rangeSelected": {
        "N": `${rangeSelected}`
      }
    },
    "Key": {
      "ClinicId": {
        "S": `${clinicId}`,
      },
      "ClinicName": {
        "S": `${clinicName}`,
      }
    },
    "TableName": `${ENVIRONMENT}-PhlebotomySite`,
    "UpdateExpression": "SET #TARGETFILL = :targetPercentage, #RANGE = :rangeSelected",
  };
  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  return response.$metadata.httpStatusCode;
}
