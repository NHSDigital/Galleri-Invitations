//IMPORTS
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import winston from "winston";

//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

// variables required for logging
const { timestamp, combine, printf } = winston.format;
const myFormat = printf(
  ({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`
);

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object

  console.log(js);

  //TODO: Need to save to GalleriBloodTestResult
  //patient.identifier.value
  //ServiceRequest.identifier.value
  //Observation.component.valueCodeableConcept.coding.code
  //Observation.component.valueCodeableConcept.coding.display
  //specimen.collection.collectionDateTime
  //id
  //meta.lastUpdated
  //identifier.value
  let Grail_FHIR_Result_Id = js?.id;
  console.log(Grail_FHIR_Result_Id);
  let Meta_Last_Updated = js?.meta?.lastUpdated;
  console.log(Meta_Last_Updated);
  let Identifier_Value = js?.identifier.value;
  console.log(Identifier_Value);
  let Grail_Id = "";
  let CSD_Result_SNOWMED_Code = "";
  let CSD_Result_SNOWMED_Display = "";
  let Blood_Draw_Date = "";
  let Cso_Result_Snowmed_Code_Primary = [];
  let Cso_Result_Snowmed_Display_Primary = [];
  let Cso_Result_Snowmed_Code_Secondary = [];
  let Cso_Result_Snowmed_Display_Secondary = [];

  for (let objs in js.entry) {
    //Grail_Id
    if (js.entry[objs].resource.resourceType === "ServiceRequest") {
      Grail_Id = js?.entry[objs]?.resource?.identifier[0]?.value;
      console.log(Grail_Id);
    }
    // CSD_Result_SNOWMED_Code and CSD_Result_SNOWMED_Display
    if (
      js?.entry[objs]?.resource?.code?.coding[0].code === "1854971000000106"
    ) {
      CSD_Result_SNOWMED_Code =
        js?.entry[objs]?.resource?.valueCodeableConcept?.coding[0]?.code;
      console.log(CSD_Result_SNOWMED_Code);
      CSD_Result_SNOWMED_Display =
        js?.entry[objs]?.resource?.valueCodeableConcept?.coding[0]?.display;
      console.log(CSD_Result_SNOWMED_Display);
    }
    // Blood_Draw_Date
    if (js.entry[objs].resource.resourceType === "Specimen") {
      Blood_Draw_Date =
        js?.entry[objs]?.resource?.collection?.collectedDateTime;
      console.log(Blood_Draw_Date);
    }
    // Cso_Result_Snowmed_Code_Primary and Cso_Result_Snowmed_Display_Primary (will be a list of multiple)
    if (
      js?.entry[objs]?.resource?.code?.coding[0].code === "1873921000000106"
    ) {
      for (let entry of js?.entry[objs]?.resource.component)
        for (let i = 0; i < entry.valueCodeableConcept.coding.length; i++) {
          Cso_Result_Snowmed_Code_Primary.push(
            entry.valueCodeableConcept.coding[i].code
          );
          console.log(Cso_Result_Snowmed_Code_Primary);
          Cso_Result_Snowmed_Display_Primary.push(
            entry.valueCodeableConcept.coding[i].display
          );
          console.log(Cso_Result_Snowmed_Display_Primary); //need to save these separately as code Arr and display Arr
        }
    }
    // // Cso_Result_Snowmed_Code_Secondary and Cso_Result_Snowmed_Display_Secondary (will be a list of multiple)
    if (
      js?.entry[objs]?.resource?.code?.coding[0].code === "1873931000000108"
    ) {
      for (let entry of js?.entry[objs]?.resource.component)
        for (let i = 0; i < entry.valueCodeableConcept.coding.length; i++) {
          Cso_Result_Snowmed_Code_Secondary.push(
            entry.valueCodeableConcept.coding[i].code
          );
          console.log(Cso_Result_Snowmed_Code_Secondary);
          Cso_Result_Snowmed_Display_Secondary.push(
            entry.valueCodeableConcept.coding[i].display
          );
          console.log(Cso_Result_Snowmed_Display_Secondary); //need to save these separately as code Arr and display Arr
        }
    }
  }

  console.log("break point");
  console.log(Grail_FHIR_Result_Id);
  console.log(Meta_Last_Updated);
  console.log(Identifier_Value);
  console.log(Grail_Id);
  console.log(CSD_Result_SNOWMED_Code);
  console.log(CSD_Result_SNOWMED_Display);
  console.log(Blood_Draw_Date);
  console.log(Cso_Result_Snowmed_Code_Primary);
  console.log(Cso_Result_Snowmed_Display_Primary);
  console.log(Cso_Result_Snowmed_Code_Secondary);
  console.log(Cso_Result_Snowmed_Display_Secondary);
};

//FUNCTIONS
/**
 * This function is used to retrieve an object from S3,
 * and allow the data retrieved to be used in your code.
 *
 * @param {string} bucketName The name of the bucket you are querying
 * @param {string} key The name of the object you are retrieving
 * @param {Object} client Instance of S3 client
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
    console.error(`Error: Failed to read from ${bucketName}/${key}`);
    throw err;
  }
};

/**
 * This function is used to write a new object in S3
 *
 * @param {string} bucketName The name of the bucket you are pushing to
 * @param {string} key The name you want to give to the file you will write to S3
 * @param {string} body The data you will be writing to S3
 * @param {Object} client Instance of S3 client
 * @returns {Object} metadata about the request, including httpStatusCode
 */
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
    console.log(
      `Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

/**
 * This function allows the user to query against DynamoDB.
 *
 * @param {Object} dbClient Instance of DynamoDB client
 * @param  {...any} params params is destructed to id, which is the value you use to query against.
 * The table is the table name (type String), attribute is the column you search against (type String),
 * attributeType is the type of data stored within that column and useIndex is toggled to true if you want to use
 * an existing index (type boolean)
 * @returns {Object} metadata about the request, including httpStatusCode
 */
export const lookUp = async (dbClient, ...params) => {
  const [id, table, attribute, attributeType, useIndex] = params;

  const ExpressionAttributeValuesKey = `:${attribute}`;
  let expressionAttributeValuesObj = {};
  let expressionAttributeValuesNestObj = {};

  expressionAttributeValuesNestObj[attributeType] = id;
  expressionAttributeValuesObj[ExpressionAttributeValuesKey] =
    expressionAttributeValuesNestObj;

  const input = {
    ExpressionAttributeValues: expressionAttributeValuesObj,
    KeyConditionExpression: `${attribute} = :${attribute}`,
    TableName: `${ENVIRONMENT}-${table}`,
  };

  if (useIndex) {
    input.IndexName = `${attribute}-index`;
  }

  const getCommand = new QueryCommand(input);
  const response = await dbClient.send(getCommand);

  if (response.$metadata.httpStatusCode != 200) {
    console.log(`look up item input = ${JSON.stringify(input, null, 2)}`);
  }

  return response;
};

/**
 * This function aims to decouple parts of the logging process to make it more flexible and extensible.
 * It is used to configure a custom logger with things such as log levels,
 * timestamp. The transport medium is the Console.
 */
export const logger = winston.createLogger({
  level: "debug",
  format: combine(timestamp({ format: "YYYY-MM-DD hh:mm:ss.SSS A" }), myFormat),
  transports: [new winston.transports.Console()],
});
