import { DynamoDBClient, UpdateItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
// {
//   "clinicInfo": {
//     "clinicId": "CA49B190",
//     "clinicName": "Phlebotomy clinic 12",
//     "rangeSelected": "3",
//     "targetPercentage": "99"
//   },
//   "selectedParticipants": [
//     "9000134926",
//     "9000202600",
//     "9000199958",
//     "9000278081",
//     "9000197491",
//     "9000233937",
//     "9000171423",
//     "9000109252",
//     "9000228556",
//     "9000058996",
//     "9000019544",
//     "9000044634",
//     "9000020041",
//     "9000094871",
//     "9000011031",
//     "9000221463",
//     "9000220974",
//     "9000276739",
//     "9000161766",
//     "9000101012",
//     "9000251372",
//     "9000149009",
//     "9000019743",
//     null,
//     "9000076685",
//     "9000021542",
//     "9000207401",
//     "9000105463",
//     "9000073561",
//     "9000061067",
//     "9000078452",
//     "9000272212",
//     "9000113733",
//     null,
//     "9000178033",
//     "9000061749",
//     "9000021637",
//     "9000177683",
//     "9000056144",
//     "9000169036"
//   ]
// }

const client = new DynamoDBClient({ region: "eu-west-2" });

const ENVIRONMENT = process.env.environment;


export const handler = async (event, context) => {
  //values extracted from front-end payload when calculate number to invite button is fired
  // const personIdentified = event.body !== null ? JSON.stringify(event.body.replace(/ /g, '')) : "";

  // const buffer = Buffer.from(JSON.stringify(personIdentified));
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

  // take the list and async update the records to set flag to true
  // once done return success and
  try {
    // set person
    let personUpdated = false;
    let siteUpdated = false;

    const responsePopulation = await updatePersonsToBeInvited(personIdentifiedArray, client)
    const responsePhlebotomySite = await updateClinicFields(clinicInfo, client)

    if (responsePopulation.every(element => element.value === 200)){
      console.log("All persons successfully updated")
      personUpdated = true;
    }

    if (responsePhlebotomySite == 200){
      console.log("Site successfully updated")
      siteUpdated = true;
    }

    if (siteUpdated && personUpdated){ // should separate out
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

export async function updateRecord(record, client){
  // Get the Lsoa code for the record
  const lsoaCodeReturn = await getLsoaCode(record, client);
  // take single record and update that individual to have a identifiedToBeInvited field = true
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
