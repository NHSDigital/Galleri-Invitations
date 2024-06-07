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
        const rejectedReason =
          "Error: ClinicId not found in PhlebotomySite table " +
          JSON.stringify(result["Items"]);
        const dateTime = new Date(Date.now()).toISOString();
        const key = `invalidData/invalidRecord_${dateTime}.json`;
        //reject record, push to s3 failedRecords folder
        await pushCsvToS3(
          bucket,
          JSON.stringify(csvString),
          key,
          rejectedReason,
          s3
        );
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
          const rejectedReason =
            "Error: ClinicId does not match " + JSON.stringify(result["Items"]);
          const dateTime = new Date(Date.now()).toISOString();
          const key = `invalidData/invalidRecord_${dateTime}.json`;
          await pushCsvToS3(
            bucket,
            JSON.stringify(csvString),
            key,
            rejectedReason,
            s3
          );
        }
      }
    }
  } catch (error) {
    console.error("Error: ", error);
  }
};

/**
 * This function is used to retrieve an object from S3,
 * and allow the data retrieved to be used in your code.
 * @function readCsvFromS3
 * @param {string} bucketName The name of the bucket you are querying
 * @param {string} key The name of the object you are retrieving
 * @param {S3Client} client Instance of S3 client
 * @returns {Object} The data of the file you retrieved
 */
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
/**
 * This function is used to write a new object in S3
 * @function pushCsvToS3
 * @param {string} bucketName The name of the bucket you are pushing to
 * @param {string} body The data you will be writing to S3
 * @param {string} key The name you want to give to the file you will write to S3
 * @param {string} rejectedReason The rejected reason
 * @param {S3Client} client Instance of S3 client
 * @returns {Object} metadata about the request, including httpStatusCode
 */
export const pushCsvToS3 = async (
  bucketName,
  body,
  key,
  rejectedReason,
  client
) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );
    console.log(`Successfully pushed to ${bucketName}/${key}`);
    console.log(rejectedReason + key);
    return response;
  } catch (err) {
    console.log(`Error: Failed to push to ${bucketName}/${key} ${err}`);
    throw err;
  }
};

/**
 * Queries DynamoDB table and returns items found based on primary key field/value
 * @async
 * @function getItemsFromTable
 * @param {string} table Table name
 * @param {DynamoDBClient} client Instance of DynamoDB client
 * @param {string} key Primary key value
 * @returns {Array} Items returned from query
 */
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

/**
 * Checks if the payload's ClinicID matches the specified item's ClinicId.
 *
 * @async
 * @function checkPhlebotomy
 * @param {Object} payload - The payload object containing the ClinicID.
 * @param {Object} arr - The item object from result.Items[0].
 * @returns {Array|boolean} An array containing true and the ClinicName if the ClinicName matches, otherwise false.
 */
const checkPhlebotomy = async (payload, arr) => {
  if (payload?.["ClinicID"] === arr["ClinicId"]["S"]) {
    console.log(`ClinicName matched: ${payload?.["ClinicID"]}`);
    return [true, arr["ClinicName"]["S"]]; // update
  } else {
    return false; //reject record from mesh
  }
};
/**
 * Saves an object to the Phlebotomy table.
 *
 * @async
 * @function saveObjToPhlebotomyTable
 * @param {Object} MeshObj - The mesh object to be saved to the Phlebotomy table.
 * @param {string} environment - The environment name.
 * @param {DynamoDBClient} client - The database client used to interact with the Phlebotomy table.
 * @param {string} clinicName - The name of the clinic associated with the object.
 * @returns {Array} updated Clinic with item to the Phlebotomy table.
 */
export const saveObjToPhlebotomyTable = async (
  MeshObj,
  environment,
  client,
  clinicName
) => {
  let formattedObj = {};
  let totalAvailability = 0;
  for (const element of MeshObj["Schedule"]) {
    const formatedDate = dayjs(element["WeekCommencingDate"]).format(
      "DD MMMM YYYY"
    );
    formattedObj[formatedDate] = {
      N: String(element["Availability"]),
    };
    totalAvailability += Number(element["Availability"]);
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
      "#AVAILABILITY": "Availability",
    },
    ExpressionAttributeValues: {
      ":WeekCommencingDate_new": {
        M: {
          ...formattedObj,
        },
      },
      ":Availability_new": {
        N: `${totalAvailability}`,
      },
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression:
      "SET #WEEK_COMMENCING_DATE = :WeekCommencingDate_new, #AVAILABILITY = :Availability_new",
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
