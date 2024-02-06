import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { DynamoDBClient, GetItemCommand, ScanCommand, BatchWriteItemCommand } from "@aws-sdk/client-dynamodb";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;
const client = new DynamoDBClient({ region: "eu-west-2" });

export const handler = async (event, context) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    // console.log(event);
    const csvString = await readCsvFromS3(bucket, key, s3);
    console.log(csvString);
    console.log(typeof csvString);
    const js = JSON.parse(csvString);
    console.log(typeof js); //obj
    console.log(js); //
    // {
    //   ClinicCreateOrUpdate: {
    //     ClinicID: 'C1C-A1A',
    //     ODSCode: 'Y888888',
    //     ICBCode: 'QNX',
    //     ClinicName: 'GRAIL Test Clinic',
    //     Address: '210 Euston Rd, London NW1 2DA',
    //     Postcode: 'BD22 0AG',
    //     Directions: 'Closest London Underground station is Euston Square.'
    //   }
    // }

    const result = await getItemsFromTable(
      `${ENVIRONMENT}-PhlebotomySite`,
      client
    );
    // console.log(result.Items);
    console.log(js);
    const value = await checkPhlebotomy(result.Items, js, 'ClinicCreateOrUpdate', 'ClinicID');
    console.log(value);
    if (value) {
      //update
    } else {
      //add
      const create = await createPhlebotomySite(js);
      console.log(create);
      //{
      //   PutRequest: {
      //     Item: {
      //       ClinicId: [Object],
      //       ODSCode: [Object],
      //       ICBCode: [Object],
      //       ClinicName: [Object],
      //       Address: [Object],
      //       Postcode: [Object],
      //       Directions: [Object],
      //       TargetFillToPercentage: [Object]
      //      }
      //   }
      // }
      console.log(typeof create);
      const createArr = [create];
      console.log(createArr);
      let RequestItems = {};
      RequestItems[`${ENVIRONMENT}-PhlebotomySite`] = [create];
      console.log(Array.isArray(createArr));
      console.log(JSON.stringify(RequestItems));
      const command = new BatchWriteItemCommand({
        "RequestItems": RequestItems
      });
      // const command = new BatchWriteItemCommand({
      //   RequestItems: createArr
      // });
      const response = await client.send(command);
      console.log(response);
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
function checkPhlebotomy(loopedArr, arr, key, item) {
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
    if (arr.ClinicCreateOrUpdate.ClinicID === element['ClinicId']['S']) {
      return true; // update
    } else {
      return false;
      // const value = await createPhlebotomySite(js.ClinicCreateOrUpdate);
      // console.log(value);
    }
  }
}

function createPhlebotomySite(site) {
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
  }

  return Promise.resolve(item)
}
