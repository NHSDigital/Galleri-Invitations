//IMPORTS
import {
  DynamoDBClient,
  QueryCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import winston from "winston";
import get from "lodash.get";
//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

const failureBucket = process.env.FAILUREBUCKET;
const successBucket = process.env.SUCCESSBUCKET;

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

  // console.log(js);

  // let episode_event = "";
  // let Grail_FHIR_Result_Id = js?.id;
  // let Meta_Last_Updated = js?.meta?.lastUpdated;
  // let Identifier_Value = js?.identifier.value;
  // let Grail_Id = "";
  // let CSD_Result_SNOWMED_Code = "";
  // let CSD_Result_SNOWMED_Display = "";
  // let Blood_Draw_Date = "";
  // let Cso_Result_Snowmed_Code_Primary = [];
  // let Cso_Result_Snowmed_Display_Primary = [];
  // let Cso_Result_Snowmed_Code_Secondary = [];
  // let Cso_Result_Snowmed_Display_Secondary = [];
  // let Participant_Id = "";
  let payloadPdf = "";
  let fhirPayload = {
    episode_event: "",
    Grail_FHIR_Result_Id: js?.id,
    Meta_Last_Updated: js?.meta?.lastUpdated,
    Identifier_Value: js?.identifier.value,
    Grail_Id: "",
    CSD_Result_SNOWMED_Code: "",
    CSD_Result_SNOWMED_Display: "",
    Blood_Draw_Date: "",
    Cso_Result_Snowmed_Code_Primary: [],
    Cso_Result_Snowmed_Display_Primary: [],
    Cso_Result_Snowmed_Code_Secondary: [],
    Cso_Result_Snowmed_Display_Secondary: [],
    Participant_Id: "",
  };

  for (let objs in js.entry) {
    //Grail_Id
    if (get(js.entry[objs].resource, `resourceType`) === "ServiceRequest") {
      console.log("inside");
      console.log(get(js.entry[objs].resource.identifier[0], `value`));
      fhirPayload.Grail_Id = get(
        js.entry[objs].resource.identifier[0],
        `value`
      );
    }

    // CSD_Result_SNOWMED_Code and CSD_Result_SNOWMED_Display
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1854971000000106"
    ) {
      fhirPayload.CSD_Result_SNOWMED_Code = get(
        js.entry[objs].resource,
        `valueCodeableConcept.coding[0].code`
      );
      fhirPayload.CSD_Result_SNOWMED_Display = get(
        js.entry[objs].resource,
        `valueCodeableConcept.coding[0].display`
      );
    }
    // // Blood_Draw_Date
    if (get(js.entry[objs].resource, `resourceType`) === "Specimen") {
      console.log("inside");
      fhirPayload.Blood_Draw_Date = get(
        js.entry[objs].resource,
        `collection.collectedDateTime`
      );
    }
    // // Cso_Result_Snowmed_Code_Primary and Cso_Result_Snowmed_Display_Primary (will be a list of multiple)
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1873921000000106"
    ) {
      for (let entry of get(js.entry[objs].resource, `component`)) {
        for (
          let i = 0;
          i < get(entry.valueCodeableConcept, `coding`).length;
          i++
        ) {
          fhirPayload.Cso_Result_Snowmed_Code_Primary.push(
            get(entry.valueCodeableConcept.coding[i], `code`)
          );
          fhirPayload.Cso_Result_Snowmed_Display_Primary.push(
            get(entry.valueCodeableConcept.coding[i], `display`)
          );
        }
      }
    }

    // // Cso_Result_Snowmed_Code_Secondary and Cso_Result_Snowmed_Display_Secondary (will be a list of multiple)
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1873931000000108"
    ) {
      for (let entry of get(js.entry[objs].resource, `component`)) {
        for (
          let i = 0;
          i < get(entry.valueCodeableConcept, `coding`).length;
          i++
        ) {
          fhirPayload.Cso_Result_Snowmed_Code_Secondary.push(
            get(entry.valueCodeableConcept.coding[i], `code`)
          );
          fhirPayload.Cso_Result_Snowmed_Display_Secondary.push(
            get(entry.valueCodeableConcept.coding[i], `display`)
          );
        }
      }
    }
    // // Participant_Id
    if (get(js.entry[objs].resource, `resourceType`) === "Patient") {
      fhirPayload.Participant_Id = get(
        js?.entry[objs],
        `resource.identifier[0].value`
      );
    }
    //PDF
    if (get(js.entry[objs].resource, `resourceType`) === "DiagnosticReport") {
      payloadPdf = get(js.entry[objs].resource.presentedForm[0], `data`);
    }
  }

  console.log(JSON.stringify(fhirPayload));
  const bufferData = Buffer.from(payloadPdf, "base64");
  console.log(bufferData.length);
  // console.log(payloadPdf);
  //TODO: check out of order message
  //use Meta_Last_Updated and Identifier_Value,
  //need to lookup GalleriBloodTestResult, if no entry insert
  //if record exists and lookup.Items[0] exists, check Meta_Last_Updated > ddb Meta_Last_Updated (Accept)
  //^ save js obj (payload) to step 4 output success bucket and save to ddb. Transactional Write to
  //GalleriBloodTestResult and Episode
  //Also save decoded pdf to S3

  // if < ddb, reject record - step4 output error bucket
  const episodeResponse = await lookUp(
    dbClient,
    fhirPayload.Participant_Id,
    "Episode",
    "Participant_Id",
    "S",
    true
  );
  console.log(JSON.stringify(episodeResponse?.Items[0]));
  console.log("episodeResponse");
  const episodeItemStatus = episodeResponse?.Items[0]?.Episode_Status?.S;
  console.log(episodeItemStatus);
  const episodeBatchId = episodeResponse?.Items[0]?.Batch_Id?.S;
  const episodeParticipantId = episodeResponse?.Items[0]?.Participant_Id?.S;

  const BloodTestResponse = await lookUp(
    dbClient,
    fhirPayload.Participant_Id,
    "GalleriBloodTestResult",
    "Participant_Id",
    "S",
    false
  );
  const BloodTestItems = BloodTestResponse?.Items[0]?.Identifier_Value?.S;
  console.log(BloodTestItems);
  const BloodTestMetaUpdateItems =
    BloodTestResponse?.Items[0]?.Meta_Last_Updated?.S;

  console.log("break point");
  // console.log(Grail_FHIR_Result_Id);
  // console.log(Meta_Last_Updated);
  // console.log(Identifier_Value);
  // console.log(Grail_Id);
  // console.log(CSD_Result_SNOWMED_Code);
  // console.log(CSD_Result_SNOWMED_Display);
  // console.log(Blood_Draw_Date);
  // console.log(Cso_Result_Snowmed_Code_Primary);
  // console.log(Cso_Result_Snowmed_Display_Primary);
  // console.log(Cso_Result_Snowmed_Code_Secondary);
  // console.log(Cso_Result_Snowmed_Display_Secondary);
  // console.log(Participant_Id);

  //matches participant
  if (episodeItemStatus) {
    const dateTime = new Date(Date.now()).toISOString();
    fhirPayload.episodeStatus = episodeItemStatus;
    console.log("here");
    console.log(fhirPayload.episodeStatus);
    if (!BloodTestItems) {
      console.log("insert new record");
      let result = await checkResult(
        js,
        episodeItemStatus,
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload
      );
      console.log(result);
      if (result) {
        const pdfconfirmation = await pushCsvToS3(
          `${ENVIRONMENT}-${successBucket}`,
          `GalleriTestResults/${fhirPayload.Participant_Id}_pdf_${dateTime}.pdf`,
          bufferData,
          s3
        );
        const fhirConfirmation = await pushCsvToS3(
          `${ENVIRONMENT}-${successBucket}`,
          `GalleriTestResults/${fhirPayload.Participant_Id}_fhir_message_${dateTime}.pdf`,
          csvString,
          s3
        );
        return [pdfconfirmation, fhirConfirmation];
      }
      //if success, also decode pdf and push to s3
    } else if (BloodTestItems) {
      console.log("check timestamp from db and identifier value");
      if (
        fhirPayload.Identifier_Value === BloodTestItems && //match identifier from ddb to payload
        fhirPayload.Meta_Last_Updated > BloodTestMetaUpdateItems //check last updated from payload is more recent
      ) {
        console.log("update record");
        let result = await checkResult(
          js,
          episodeItemStatus,
          dbClient,
          episodeParticipantId,
          episodeBatchId,
          fhirPayload
        );
        console.log(result);
        if (result) {
          const pdfconfirmation = await pushCsvToS3(
            `${ENVIRONMENT}-${successBucket}`,
            `GalleriTestResults/${fhirPayload.Participant_Id}_pdf_${dateTime}.pdf`,
            bufferData,
            s3
          );
          const fhirConfirmation = await pushCsvToS3(
            `${ENVIRONMENT}-${successBucket}`,
            `GalleriTestResults/${fhirPayload.Participant_Id}_fhir_message_${dateTime}.pdf`,
            csvString,
            s3
          );
          return [pdfconfirmation, fhirConfirmation];
        }
      } else {
        console.error(
          "Error: Reject record; Invalid timestamp or identifier value"
        );
        const confirmation = await pushCsvToS3(
          `${ENVIRONMENT}-${failureBucket}`,
          `invalidRecord/invalidRecord_${dateTime}.json`,
          csvString,
          s3
        );
        return confirmation;
      }
    }
  } else {
    console.error("Error: No matching participant, reject record");
    const confirmation = await pushCsvToS3(
      `${ENVIRONMENT}-${failureBucket}`,
      `invalidRecord/invalidRecord_${dateTime}.json`,
      csvString,
      s3
    );
    return confirmation;
  }
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

//need participant_Id and Grail_Id for composite key GalleriBloodTestResult
//need batch_Id and Participant_Id for composite key Episode
//Need to also update Episode_Status_Updated
export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  fhirPayload,
  episodeStatus
) => {
  console.log(fhirPayload.episode_event);
  const timeNow = new Date(Date.now()).toISOString();
  console.log(timeNow);
  const params = {
    TransactItems: [
      {
        Update: {
          Key: {
            Batch_Id: { S: batchId },
            Participant_Id: { S: participantId },
          },
          UpdateExpression: `SET Episode_Event = :episodeEvent, Episode_Event_Updated = :timeNow, Episode_Status = :episodeStatus, Episode_Status_Updated = :timeNow`,
          TableName: `${ENVIRONMENT}-Episode`,
          ExpressionAttributeValues: {
            ":episodeEvent": { S: fhirPayload.episode_event },
            ":timeNow": { S: timeNow },
            ":episodeStatus": { S: episodeStatus },
          },
        },
      },
      {
        Update: {
          Key: {
            Participant_Id: { S: participantId },
            Grail_Id: { S: fhirPayload.Grail_Id },
          },
          UpdateExpression: `SET Grail_FHIR_Result_Id = :GrailFHIRResult, Meta_Last_Updated = :MetaLU, Identifier_Value = :IV, CSD_Result_SNOWMED_Code = :CSDSNOWMEDCode, CSD_Result_SNOWMED_Display = :CSDSNOWMEDDisplay, Blood_Draw_Date = :Blood_Draw_Date, Cso_Result_Snowmed_Code_Primary= :SCode_Primary, Cso_Result_Snowmed_Display_Primary = :SDisplay_Primary, Cso_Result_Snowmed_Code_Secondary = :SCode_Secondary, Cso_Result_Snowmed_Display_Secondary = :SDisplay_Secondary`,
          TableName: `${ENVIRONMENT}-GalleriBloodTestResult`,
          ExpressionAttributeValues: {
            ":GrailFHIRResult": { S: fhirPayload.Grail_FHIR_Result_Id },
            ":MetaLU": { S: fhirPayload.Meta_Last_Updated },
            ":IV": { S: fhirPayload.Identifier_Value },
            ":CSDSNOWMEDCode": {
              S: fhirPayload.CSD_Result_SNOWMED_Code,
            },
            ":CSDSNOWMEDDisplay": {
              S: fhirPayload.CSD_Result_SNOWMED_Display,
            },
            ":Blood_Draw_Date": { S: fhirPayload.Blood_Draw_Date },
            ":SCode_Primary": {
              SS: fhirPayload.Cso_Result_Snowmed_Code_Primary,
            },
            ":SDisplay_Primary": {
              SS: fhirPayload.Cso_Result_Snowmed_Display_Primary,
            },
            ":SCode_Secondary": {
              SS: fhirPayload.Cso_Result_Snowmed_Code_Secondary,
            },
            ":SDisplay_Secondary": {
              SS: fhirPayload.Cso_Result_Snowmed_Display_Secondary,
            },
          },
        },
      },
    ],
  };

  try {
    console.log(JSON.stringify(params));
    const command = new TransactWriteItemsCommand(params);
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(
        `Error occurred while trying to update db with item: ${participantId}`
      );
      return false;
    } else {
      console.log(`Successfully updated db with item: ${participantId}`);
      return true;
    }
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
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

export const checkResult = async (
  payload,
  episodeItemStatus,
  dbClient,
  episodeParticipantId,
  episodeBatchId,
  fhirPayload
) => {
  if (payload?.id.match(/\b(CancerMarkersDetected)/g)) {
    fhirPayload.episode_event = "Result - CSD";
    console.log(fhirPayload.episode_event);
    if (episodeItemStatus === "Open") {
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        episodeItemStatus
      );
      return result;
      //THEN update episode_event  to 'Result - CSD'
    } else {
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        "Open"
      );
      return result;
      // THEN update episode_event  to 'Result - CSD' AND set Episode_Status to 'Open'
    }
  }
  if (payload?.id.match(/\b(CancerMarkersNotDetected)/g)) {
    fhirPayload.episode_event = "Result - No CSD";
    console.log(fhirPayload.episode_event);
    if (episodeItemStatus === "Open") {
      // THEN update episode_event to  ‘Result - No CSD’
      // AND close the episode
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        "Closed"
      );
      return result;
    }
  }

  if (payload?.id.match(/\b(AmendedTest)/g)) {
    fhirPayload.episode_event = "Result - Amended";
    console.log(fhirPayload.episode_event);
    if (episodeItemStatus === "Open") {
      // THEN update episode_event  to 'Result - Amended'
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        episodeItemStatus
      );
      return result;
    }
  }
  if (payload?.id.match(/\b(CorrectedTest)/g)) {
    fhirPayload.episode_event = "Result - Correction";
    console.log(fhirPayload.episode_event);
    if (episodeItemStatus === "Open") {
      // THEN update episode_event to 'Result - Correction'
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        episodeItemStatus
      );
      return result;
    } else {
      // THEN open the episode AND update episode_event to 'Result - Correction'
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        "Open"
      );
      return result;
    }
  }
  if (payload?.id.match(/\b(CancelledTest)/g)) {
    fhirPayload.episode_event = "Result - Cancelled Test";
    console.log(fhirPayload.episode_event);
    if (episodeItemStatus === "Open") {
      // THEN update episode_event to 'Result - Cancelled Test'
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        episodeItemStatus
      );
      return result;
    } else {
      // THEN open the episode AND update episode_event to 'Result - Cancelled Test'
      let result = await transactionalWrite(
        dbClient,
        episodeParticipantId,
        episodeBatchId,
        fhirPayload,
        "Open"
      );
      return result;
    }
  }
};
