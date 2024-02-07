import {
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommand,
  UpdateItemCommand
} from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const js = JSON.parse(csvString);
    const result = await getItemsFromTable(
      `${ENVIRONMENT}-PhlebotomySite`,
      client
    );
    const value = await checkPhlebotomy(result.Items, js, 'ClinicCreateOrUpdate', 'ClinicID');
    if (value) {
      //update
      saveObjToPhlebotomyTable(js, ENVIRONMENT, client);
    } else {
      //add
      const create = await createPhlebotomySite(js);
      let RequestItems = {};
      RequestItems[`${ENVIRONMENT}-PhlebotomySite`] = [create];
      const command = new BatchWriteItemCommand({
        "RequestItems": RequestItems
      });
      const response = await client.send(command);
      if (response.$metadata.httpStatusCode !== 200) {
        console.error(`Error inserted item: ${JSON.stringify(js)}`);
      } else {
        console.log(`Successfully inserted item: ${JSON.stringify(js)}`);
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
};

// METHODS
export const readCsvFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return response.Body.transformToString();
  } catch (err) {
    console.log(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};


export async function getItemsFromTable(table, client) {
  const response = await client.send(
    new ScanCommand({
      TableName: table,
    })
  );

  return response;
}

//cycle through the json returned and compare to each phlebotomy site
export const checkPhlebotomy = async (loopedArr, arr, key, item) => {
  // console.log('abdul args');
  // console.log(...arguments);
  // console.log('abdul args');
  for (const element of loopedArr) {
    // console.log('arr.ClinicCreateOrUpdate.ClinicID')
    // console.log(arr);
    // console.log(arr.ClinicCreateOrUpdate.ClinicID);
    // console.log('element.clinicID');
    // console.log('elemet = ', JSON.stringify(element));
    // console.log(element['ClinicId']);
    // console.log(element['ClinicId']['S']);
    // if (js.ClinicCreateOrUpdate.ClinicID === element.ClinicId.S){
    console.log(element['ClinicId']['S']);
    if (arr[key][item] === element['ClinicId']['S']) {
      return true; // update
    } else {
      return false;
      // const value = await createPhlebotomySite(js.ClinicCreateOrUpdate);
      // console.log(value);
    }
  }
};

export const createPhlebotomySite = (site) => {
  const item = {
    PutRequest: {
      Item: {
        'ClinicId': {
          S: `${site.ClinicCreateOrUpdate.ClinicID}`
        },
        'ODSCode': {
          S: `${site.ClinicCreateOrUpdate.ODSCode}`
        },
        'ICBCode': {
          S: `${site.ClinicCreateOrUpdate.ICBCode}`
        },
        'ClinicName': {
          S: `${site.ClinicCreateOrUpdate.ClinicName}`
        },
        'Address': {
          S: `${site.ClinicCreateOrUpdate.Address}`
        },
        'Postcode': {
          S: `${site.ClinicCreateOrUpdate.Postcode}`
        },
        'Directions': {
          S: `${site.ClinicCreateOrUpdate.Directions}`
        },
        'TargetFillToPercentage': {
          N: `50`
        }
      }
    }
  };

  return Promise.resolve(item);
};


export const saveObjToPhlebotomyTable = async (MeshObj, environment, client) => {

  const params = {
    "Key": {
      "ClinicId": {
        "S": MeshObj["ClinicCreateOrUpdate"]["ClinicID"],
      },
      "ClinicName": {
        "S": MeshObj["ClinicCreateOrUpdate"]["ClinicName"],
      }
    },
    ExpressionAttributeNames: {
      "#ODSCode": "ODSCode",
      "#ICBCode": "ICBCode",
      "#Address": "Address",
      "#Postcode": "PostCode",
      "#Directions": "Directions",
    },
    ExpressionAttributeValues: {
      ":ODSCode_new": {
        "S": MeshObj['ClinicCreateOrUpdate']['ODSCode'],
      },
      ":ICBCode_new": {
        "S": MeshObj['ClinicCreateOrUpdate']['ICBCode'],
      },
      ":Address_new": {
        "S": MeshObj['ClinicCreateOrUpdate']['Address'],
      },
      ":Postcode_new": {
        "S": MeshObj['ClinicCreateOrUpdate']['Postcode'],
      },
      ":Directions_new": {
        "S": MeshObj['ClinicCreateOrUpdate']['Directions'],
      },
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression: "SET #ODSCode = :ODSCode_new, #ICBCode = :ICBCode_new,  #Address = :Address_new, #Postcode = :Postcode_new, #Directions = :Directions_new"
  };
  // console.log(JSON.stringify(params));
  const command = new UpdateItemCommand(params);
  // console.log(JSON.stringify(command));
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error updating item: ${JSON.stringify(MeshObj)}`);
      return false;
    } else {
      console.log(`Successfully updated item: ${JSON.stringify(MeshObj)}`);
      return true;
    }
  } catch (error) {
    console.log(`Error: ${error}`);
  }
};
