import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  //values extracted from front-end payload when calculate number to invite button is fired
  const personIdentified = event.body !== null ? JSON.stringify(event.body.replace(/ /g, '')) : "";

  const buffer = Buffer.from(JSON.stringify(personIdentified));

  const eventJson = JSON.parse(buffer)
  const personIdentifiedArray = eventJson.selectedParticipants
  const clincInfo = eventJson.clincInfo

  let responseObject = {
    "headers": {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST",
    },
    "isBase64Encoded": true
  };

  // take the list and async update the records to set flag to true
  // once done return success and
  try {
    // set person
    let personUpdated = false
    let siteUpdated = false
    const responsePopulation = await updatePersonsToBeInvited(personIdentifiedArray)
    if (responsePopulation.every(element => element = 200)){
      personUpdated = true
    }

    const responsePhlebotomySite = await updateClinicFields(personIdentifiedArray)
    if (responsePhlebotomySite = 200){
      siteUpdated = true
    }

    if (siteUpdated && personUpdated){ // should separate out
      responseObject.statusCode = 200;
      responseObject.body = "Success"

      return responseObject
    } else {
      throw new Error(`Action to update Population was successful? ${personUpdated}\nAction to update PhlebotomySite was successful? ${siteUpdated}`)
    }
  } catch(e){
    responseObject.statusCode = 404;
    responseObject.body = e;

    return responseObject
  }
};

//METHODS
export async function updateRecord(record, client){
  // take single record and update that individual to have a identifiedToBeInvited field = true
  const input = {
    "ExpressionAttributeValues": {
      ":to_be_invited": {
        "BOOL": "true",
      },
    },
    "Key": {
      "PersonId": {
        "N": `${record}`,
      },
    },
    "TableName": "Population",
    "UpdateExpression": "SET #identifiedToBeInvited = :to_be_invited",
  };
  const command = new UpdateItemCommand(input);
  const response = await client.send(command)
  return response.$metadata.statusCode
}

export async function updatePersonsToBeInvited(recordArray, client){
  return Promise.all(
    recordArray.map(async (record) =>  {
      return updateRecord(record, client)
    })
  )
}

export async function updateClinicFields(clinicInfo, client){
  const { clinicId, rangeSelected, targetPercentage } = clinicInfo
  const input = {
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
        "N": `${clinicId}`,
      },
    },
    "TableName": "PhlebotomySite",
    "UpdateExpression": "SET #TargetFillToPercentage = :targetPercentage, #LastSelectedRange = :rangeSelected",
  };
  const command = new UpdateItemCommand(input);
  const response = await client.send(command)
  return response.$metadata.statusCode
}
