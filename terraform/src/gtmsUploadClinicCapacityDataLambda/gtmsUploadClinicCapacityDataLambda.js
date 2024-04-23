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
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const js = JSON.parse(csvString);

    for (const element of js["ClinicScheduleSummary"][
      "ClinicScheduleSummary"
    ]) {
      const result = await getItemsFromTable(
        `PhlebotomySite`,
        client,
        element["ClinicID"]
      );

      if (Object.keys(result.Items).length === 0) {
        const dateTime = new Date(Date.now()).toISOString();
        //reject record, push to s3 failedRecords folder
        let response = await pushCsvToS3(
          bucket,
          `invalidData/invalidRecord_${dateTime}.json`,
          JSON.stringify(csvString),
          s3
        );
        if (response.$metadata.httpStatusCode !== 200) {
          console.error(
            "Error: uploading items to s3 failedRecords folder " +
              +`invalidData/invalidRecord_${dateTime}.json` +
              ` ${response.$metadata.error} `
          );
        } else {
          console.log("response");
          console.log(response);
          console.error(
            `Error: entry JSON did not match any ClinicIds in PhlebotomySite table. invalidData/invalidRecord_${dateTime}.json ` +
              `${response.$metadata.err}`
          );
        }
      } else {
        const value = await checkPhlebotomy(element, result.Items[0]);
        if (value[0]) {
          //update
          const params = await saveObjToPhlebotomyTable(
            element,
            ENVIRONMENT,
            client,
            value[1]
          );
          console.log(`${params ? "Success" : "Failed"}`);
        } else {
          const dateTime = new Date(Date.now()).toISOString();
          //reject record, push to s3 failedRecords folder
          let response = await pushCsvToS3(
            bucket,
            `invalidData/invalidRecord_${dateTime}.json`,
            JSON.stringify(csvString),
            s3
          );
          if (response.$metadata.httpStatusCode !== 200) {
            console.error(
              "Error: uploading items to s3 failedRecords folder " +
                +`invalidData/invalidRecord_${dateTime}.json` +
                ` ${response.$metadata.error} `
            );
          } else {
            console.error(
              "Error: clinicIds record is not found or data is not consistent " +
                JSON.stringify(result["Items"]) +
                `invalidData/invalidRecord_${dateTime}.json ` +
                `${response.$metadata.error}`
            );
            console.log(JSON.stringify(result["Items"]));
          }
        }
      }
    }
  } catch (error) {
    console.error("Error: occurred to read readCsvFromS3", error);
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

const checkPhlebotomy = async (payload, arr) => {
  if (payload?.["ClinicID"] === arr["ClinicId"]["S"]) {
    console.log(`ClinicName matched: ${payload?.["ClinicID"]}`);
    return [true, arr["ClinicName"]["S"]]; // update
  } else {
    return false; //reject record from mesh
  }
};

export const saveObjToPhlebotomyTable = async (
  MeshObj,
  environment,
  client,
  clinicName
) => {
  let formattedObj = {};
  for (const element of MeshObj["Schedule"]) {
    const formatedDate = dayjs(element["WeekCommencingDate"]).format(
      "DD MMMM YYYY"
    );
    formattedObj[formatedDate] = {
      N: String(element["Availability"]),
    };
  }

  const params = {
    Key: {
      ClinicId: {
        S: MeshObj["ClinicID"],
      },
      ClinicName: {
        S: clinicName,
      },
    },
    ExpressionAttributeNames: {
      "#WEEK_COMMENCING_DATE": "WeekCommencingDate",
    },
    ExpressionAttributeValues: {
      ":WeekCommencingDate_new": {
        M: {
          ...formattedObj,
        },
      },
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression: "SET #WEEK_COMMENCING_DATE = :WeekCommencingDate_new",
  };

  const command = new UpdateItemCommand(params);
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error: updating item ${JSON.stringify(MeshObj)}`);
      return false;
    } else {
      console.log(
        `Successfully updated Clinic with item: ${JSON.stringify(MeshObj)}`
      );
      return true;
    }
  } catch (error) {
    console.error(`Error: updating Clinic items ${error}`);
  }
};
