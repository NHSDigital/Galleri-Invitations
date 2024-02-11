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
import dayjs from "dayjs";

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
    console.log(JSON.stringify(js));

    console.log(js['ClinicScheduleSummary'][0]['Schedule'][0]['WeekCommencingDate']);
    const dt = dayjs(js['ClinicScheduleSummary'][0]['Schedule'][0]['WeekCommencingDate']);
    const formatted = dt.format("DD MMMM YYYY");
    console.log(formatted);
    const result = await getItemsFromTable(
      `${ENVIRONMENT}-PhlebotomySite`,
      client
    );
    // console.log(JSON.stringify(result['Items'][0]));
    const value = await checkPhlebotomy(result.Items, js, 'ClinicScheduleSummary', 'ClinicID');
    console.log(value);
    if (value[0]) {
      //update
      const params = saveObjToPhlebotomyTable(js, ENVIRONMENT, client, value[1], value[2]);
      console.log(JSON.stringify(params));
    } else {
      //reject record, push to s3 failedRecords folder
    }
    // console.log(JSON.stringify(result['Items']));

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
    console.error(`Failed to read from ${bucketName}/${key}`);
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

export const checkPhlebotomy = async (loopedArr, arr, key, item) => {
  for (const element of loopedArr) {
    console.log(element['ClinicId']['S']);
    if (arr[key][0][item] === element['ClinicId']['S']) {

      console.log(`ClinicName matched: ${element['ClinicName']['S']}`);
      // console.log(element['WeekCommencingDate']['M']);
      return [true, element['ClinicName']['S'], element['WeekCommencingDate']['M']]; // update
    } else {
      return false; //reject record from mesh
    }
  }
};

export const saveObjToPhlebotomyTable = async (MeshObj, environment, client, clinicName, datesAppend) => {
  const formatedDate = dayjs(MeshObj['ClinicScheduleSummary'][0]['Schedule'][0]['WeekCommencingDate']).format("DD MMMM YYYY");
  // console.log(datesAppend);
  const commencingDateObj = {
    [formatedDate]: {
      "N": MeshObj['ClinicScheduleSummary'][0]['Schedule'][0]['Availability'],
    }, ...datesAppend
  };


  const params = {
    "Key": {
      "ClinicId": {
        "S": MeshObj["ClinicScheduleSummary"][0]["ClinicID"],
      },
      "ClinicName": {
        "S": clinicName,
      }
    },
    ExpressionAttributeNames: {
      "#Availability": "Availability",
      "#WeekCommencingDate": "WeekCommencingDate",
    },
    ExpressionAttributeValues: {
      ":availability_new": {
        "S": MeshObj['ClinicScheduleSummary'][0]['Schedule'][0]['Availability'],
      },
      ":WeekCommencingDate_new": {
        "M": {
          ...commencingDateObj
        },
      }
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression: "SET #Availability = :availability_new, #WeekCommencingDate = :WeekCommencingDate"
  };

  console.log(JSON.stringify(params));
  return params;
  // console.log(JSON.stringify(commencingDateObj));
  // return commencingDateObj;

  // const command = new UpdateItemCommand(params);
  // try {
  //   const response = await client.send(command);
  //   if (response.$metadata.httpStatusCode !== 200) {
  //     console.error(`Error updating item: ${JSON.stringify(MeshObj)}`);
  //     return false;
  //   } else {
  //     console.log(`Successfully updated item: ${JSON.stringify(MeshObj)}`);
  //     return true;
  //   }
  // } catch (error) {
  //   console.error(`Error: ${error}`);
  // }
};




// [
//   {
//       "Address": {
//           "S": "test address dynamo put"
//       },
//       "Availability": {
//           "N": "267"
//       },
//       "Directions": {
//           "S": "These will contain directions to the site"
//       },
//       "ODSCode": {
//           "S": "M40666"
//       },
//       "ClinicId": {
//           "S": "CF78U818"
//       },
//       "InvitesSent": {
//           "N": "133"
//       },
//       "ICBCode": {
//           "S": "QVV"
//       },
//       "LastSelectedRange": {
//           "N": "1"
//       },
//       "TargetFillToPercentage": {
//           "N": "50"
//       },
//       "PostCode": {
//           "S": "BH17 7DT"
//       },
//       "PrevInviteDate": {
//           "S": "Saturday 20 January 2024"
//       },
//       "ClinicName": {
//           "S": "Phlebotomy clinic 34"
//       },
//       "WeekCommencingDate": {
//           "M": {
//               "19 February 2024": {
//                   "N": "19"
//               },
//               "25 March 2024": {
//                   "N": "54"
//               },
//               "4 March 2024": {
//                   "N": "14"
//               },
//               "18 March 2024": {
//                   "N": "19"
//               },
//               "11 March 2024": {
//                   "N": "71"
//               },
//               "26 February 2024": {
//                   "N": "90"
//               }
//           }
//       }
//   }
// ]
