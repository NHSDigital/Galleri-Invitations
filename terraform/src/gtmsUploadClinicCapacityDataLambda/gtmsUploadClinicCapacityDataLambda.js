import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
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
    console.log(`Entry JSON: ${JSON.stringify(js)}`);

    const result = await getItemsFromTable(`PhlebotomySite`, client, js['ClinicScheduleSummary'][0]['ClinicID']);
    console.log(`fetched items: ${JSON.stringify(result)}`);
    if (Object.keys(result.Items).length === 0) {
      console.log(`Entry JSON did not match any ClinicIds in PhlebotomySite table`);
      const dateTime = new Date(Date.now()).toISOString();
      //reject record, push to s3 failedRecords folder
      let response = await (pushCsvToS3(
        `${ENVIRONMENT}-valid-inbound-gtms-clinic-schedule-summary`,
        `invalidData/invalidRecord_${dateTime}.json`,
        csvString,
        s3
      ));
      if (response.$metadata.httpStatusCode !== 200) {
        console.error("Error uploading item ");
      }
    }
    else {
      const value = await checkPhlebotomy(result.Items, js, 'ClinicScheduleSummary', 'ClinicID');
      if (value[0]) {
        //update
        const params = await saveObjToPhlebotomyTable(js, ENVIRONMENT, client, value[1], value[2]);
        console.log(`Success: ${params}`);
      } else {
        const dateTime = new Date(Date.now()).toISOString();
        //reject record, push to s3 failedRecords folder
        let response = await (pushCsvToS3(
          `${ENVIRONMENT}-valid-inbound-gtms-clinic-schedule-summary`,
          `invalidData/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        ));
        if (response.$metadata.httpStatusCode !== 200) {
          console.error("Error uploading item ");
        }
        console.log(JSON.stringify(result['Items']));
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
    console.error(`Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );
    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log(`Failed: ${err}`);
    throw err;
  }
};

export async function getItemsFromTable(table, client, key) {

  const params = {
    ExpressionAttributeValues: {
      ":ClinicId": {
        S: `${key}`,
      },
    },
    KeyConditionExpression: "ClinicId = :ClinicId",
    TableName: `${ENVIRONMENT}-${table}`,
    IndexName: "ClinicId-index",
  };

  const command = new QueryCommand(params);
  const response = await client.send(command);
  return response;
}

export const checkPhlebotomy = async (loopedArr, arr, key, item) => {
  for (const element of loopedArr) {
    if (arr?.[key]?.[0]?.[item] === element['ClinicId']['S']) {
      console.log(`ClinicName matched: ${element['ClinicName']['S']}`);
      return [true, element['ClinicName']['S'], element['WeekCommencingDate']['M']]; // update
    } else {
      return false; //reject record from mesh
    }
  }
};

export const saveObjToPhlebotomyTable = async (MeshObj, environment, client, clinicName, datesAppend) => {
  const formatedDate = dayjs(MeshObj['ClinicScheduleSummary'][0]['Schedule'][0]['WeekCommencingDate']).format("DD MMMM YYYY");
  const commencingDateObj = {
    [formatedDate]: {
      "N": String(MeshObj['ClinicScheduleSummary'][0]['Schedule'][0]['Availability']),
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
      "#WEEK_COMMENCING_DATE": "WeekCommencingDate",
    },
    ExpressionAttributeValues: {
      ":WeekCommencingDate_new": {
        "M": {
          ...commencingDateObj
        },
      }
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression: "SET #WEEK_COMMENCING_DATE = :WeekCommencingDate_new"
  };

  const command = new UpdateItemCommand(params);
  console.log(`request to be sent: ${JSON.stringify(command)}`);
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error updating item: ${JSON.stringify(MeshObj)}`);
      return false;
    } else {
      console.log(`Successfully updated Clinic with item: ${JSON.stringify(MeshObj)}`);
      return true;
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};
