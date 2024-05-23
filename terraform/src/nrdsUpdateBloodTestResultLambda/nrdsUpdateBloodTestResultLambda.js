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
  GetObjectTaggingCommand,
} from "@aws-sdk/client-s3";
import get from "lodash.get";
//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

const failureBucket = process.env.FAILUREBUCKET;
const successBucket = process.env.SUCCESSBUCKET;

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const tagString = await getTagFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object

  let payloadPdf = "";
  let fhirPayload = {
    episode_event: "",
    Grail_FHIR_Result_Id: get(js, `id`),
    Meta_Last_Updated: get(js, `meta.lastUpdated`),
    Identifier_Value: get(js, `identifier.value`),
    Grail_Id: "",
    CSD_Result_SNOMED_Code: "",
    Blood_Draw_Date: "",
    Cso_Result_SNOMED_Code_Primary: "",
    Cso_Result_SNOMED_Code_Secondary: "",
    Participant_Id: "",
    Result_Raw_Full_S3: "",
    Result_PDF_S3: "",
    Result_Created_By: "",
    Result_Creation: "",
    Result_Updated_By: "",
    Result_Updated: "",
    Cso_Result_Friendly_Primary: "",
    Cso_Result_Friendly_Secondary: "",
    DiagnosticReportStatus: "",
  };

  for (let objs in js.entry) {
    //Grail_Id
    if (get(js.entry[objs].resource, `resourceType`) === "ServiceRequest") {
      fhirPayload.Grail_Id = get(
        js.entry[objs].resource.identifier[0],
        `value`
      );
    }
    // CSD_Result_SNOMED_Code and CSD_Result_SNOMED_Display
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1854971000000106"
    ) {
      fhirPayload.CSD_Result_SNOMED_Code = `${get(
        js.entry[objs].resource,
        `valueCodeableConcept.coding[0].code`
      )} (${get(
        js.entry[objs].resource,
        `valueCodeableConcept.coding[0].display`
      )}),`;
    }
    // Blood_Draw_Date
    if (get(js.entry[objs].resource, `resourceType`) === "Specimen") {
      fhirPayload.Blood_Draw_Date = get(
        js.entry[objs].resource,
        `collection.collectedDateTime`
      );
    }
    // Cso_Result_SNOMED_Code_Primary and Cso_Result_SNOMED_Display_Primary (will be a list of multiple)
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1873921000000106"
    ) {
      for (let entry of get(js.entry[objs].resource, `component`)) {
        for (
          let i = 0;
          i < get(entry.valueCodeableConcept, `coding`).length;
          i++
        ) {
          fhirPayload.Cso_Result_SNOMED_Code_Primary += `${get(
            entry.valueCodeableConcept.coding[i],
            `code`
          )} (${get(entry.valueCodeableConcept.coding[i], `display`)}),`;
        }
      }
    }

    // Cso_Result_SNOMED_Code_Secondary and Cso_Result_SNOMED_Display_Secondary (will be a list of multiple)
    if (
      get(js.entry[objs].resource, `code.coding[0].code`) === "1873931000000108"
    ) {
      for (let entry of get(js.entry[objs].resource, `component`)) {
        for (
          let i = 0;
          i < get(entry.valueCodeableConcept, `coding`).length;
          i++
        ) {
          fhirPayload.Cso_Result_SNOMED_Code_Secondary += `${get(
            entry.valueCodeableConcept.coding[i],
            `code`
          )} (${get(entry.valueCodeableConcept.coding[i], `display`)}),`;
        }
      }
    }
    // Participant_Id
    if (get(js.entry[objs].resource, `resourceType`) === "Patient") {
      fhirPayload.Participant_Id = get(
        js.entry[objs],
        `resource.identifier[0].value`
      );
    }
    //PDF
    if (get(js.entry[objs].resource, `resourceType`) === "DiagnosticReport") {
      payloadPdf = get(js.entry[objs].resource.presentedForm[0], `data`);
      fhirPayload.DiagnosticReportStatus = get(
        js.entry[objs].resource,
        `status`
      );
    }
  }

  //Extract Cso_Result_Friendly_Primary and Cso_Result_Friendly_Secondary
  if (tagString.length > 0) {
    for (let i = 0; i < tagString.length; i++) {
      if (tagString[i].Key === "Cso_Result_Friendly_Primary") {
        fhirPayload.Cso_Result_Friendly_Primary = tagString[i].Value;
      }
      if (tagString[i].Key === "Cso_Result_Friendly_Secondary") {
        fhirPayload.Cso_Result_Friendly_Secondary = tagString[i].Value;
      }
    }
  }

  const episodeResponse = await lookUp(
    dbClient,
    fhirPayload.Participant_Id,
    "Episode",
    "Participant_Id",
    "S",
    true
  );

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
  const ResultCreatedByItems =
    BloodTestResponse?.Items[0]?.Result_Created_By?.S;
  const ResultUpdatedItems = BloodTestResponse?.Items[0]?.Result_Creation?.S;

  checkProperties(fhirPayload);
  const bufferData = Buffer.from(payloadPdf, "base64");
  //matches participant
  const dateTime = new Date(Date.now()).toISOString();
  if (episodeItemStatus) {
    fhirPayload.episodeStatus = episodeItemStatus;
    fhirPayload.Result_Raw_Full_S3 = `s3://${ENVIRONMENT}-${successBucket}/GalleriTestResults/${fhirPayload.Participant_Id}_fhir_message_${dateTime}.json`;
    fhirPayload.Result_PDF_S3 = `s3://${ENVIRONMENT}-${successBucket}/GalleriTestResults/${fhirPayload.Participant_Id}_pdf_${dateTime}.pdf`;
    if (!BloodTestItems) {
      console.log("insert new record");
      fhirPayload.Result_Created_By = "GPS";
      fhirPayload.Result_Creation = new Date(Date.now()).toISOString();
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
        await pushCsvToS3(
          `${ENVIRONMENT}-${successBucket}`,
          `GalleriTestResults/${fhirPayload.Participant_Id}_fhir_message_${dateTime}.json`,
          csvString,
          s3
        );
        if (bufferData.length > 0) {
          await pushCsvToS3(
            `${ENVIRONMENT}-${successBucket}`,
            `GalleriTestResults/${fhirPayload.Participant_Id}_pdf_${dateTime}.pdf`,
            bufferData,
            s3
          );
        }
      }
      //if success, also decode pdf and push to s3
    } else if (BloodTestItems) {
      fhirPayload.Result_Created_By = ResultCreatedByItems;
      fhirPayload.Result_Creation = ResultUpdatedItems;
      fhirPayload.Result_Updated_By = "GPS";
      fhirPayload.Result_Updated = new Date(Date.now()).toISOString();
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
          await pushCsvToS3(
            `${ENVIRONMENT}-${successBucket}`,
            `GalleriTestResults/${fhirPayload.Participant_Id}_fhir_message_${dateTime}.json`,
            csvString,
            s3
          );
          if (bufferData.length > 0) {
            await pushCsvToS3(
              `${ENVIRONMENT}-${successBucket}`,
              `GalleriTestResults/${fhirPayload.Participant_Id}_pdf_${dateTime}.pdf`,
              bufferData,
              s3
            );
          }
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
 * This function is used to retrieve the tags associated to an object in S3
 *
 * @param {String} bucketName The name of the bucket you are querying
 * @param {String} key The name of the object you are retrieving
 * @param {Object} client Instance of S3 client
 * @returns {Array} An array of all tags on object being returned
 */
export const getTagFromS3 = async (bucketName, key, client) => {
  try {
    const tag = await client.send(
      new GetObjectTaggingCommand({
        Bucket: bucketName,
        Key: key,
      })
    );
    return tag.TagSet;
  } catch (err) {
    console.error(`Error: Failed to read from ${bucketName}/${key}`);
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
    console.error(
      `Error: Failed to push to ${bucketName}/${key}. Error Message: ${err}`
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
 * This function is used to write to both episode and GalleriBloodTestResult table depending on the received payload
 *
 * @param {Object} client Instance of DynamoDB client
 * @param {String} participantId Sort Key for Episode table
 * @param {String} batchId Partition Key for Episode table
 * @param {Object} fhirPayload Object containing attributes from payload
 * @param {String} episodeStatus Status to set in Episode table
 * @returns {Boolean}
 */
export const transactionalWrite = async (
  client,
  participantId,
  batchId,
  fhirPayload,
  episodeStatus
) => {
  const timeNow = new Date(Date.now()).toISOString();
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
          UpdateExpression: `SET Grail_FHIR_Result_Id = :GrailFHIRResult, Meta_Last_Updated = :MetaLU, Identifier_Value = :IV, CSD_Result_SNOMED_Code = :CSDSNOMEDCode, Blood_Draw_Date = :Blood_Draw_Date, Cso_Result_SNOMED_Code_Primary = :SCode_Primary, Cso_Result_SNOMED_Code_Secondary = :SCode_Secondary, Result_Raw_Full_S3 = :Result_Raw_Full_S3, Result_PDF_S3 = :Result_PDF_S3, Result_Created_By = :Result_Created_By, Result_Creation = :Result_Creation, Result_Updated_By = :Result_Updated_By, Result_Updated = :Result_Updated, Cso_Result_Friendly_Primary = :Cso_Result_Friendly_Primary, Cso_Result_Friendly_Secondary = :Cso_Result_Friendly_Secondary, DiagnosticReportStatus = :DiagnosticReportStatus`,
          TableName: `${ENVIRONMENT}-GalleriBloodTestResult`,
          ExpressionAttributeValues: {
            ":GrailFHIRResult": { S: fhirPayload.Grail_FHIR_Result_Id },
            ":MetaLU": { S: fhirPayload.Meta_Last_Updated },
            ":IV": { S: fhirPayload.Identifier_Value },
            ":CSDSNOMEDCode": {
              S: fhirPayload.CSD_Result_SNOMED_Code,
            },
            ":Blood_Draw_Date": { S: fhirPayload.Blood_Draw_Date },
            ":SCode_Primary": {
              S: fhirPayload.Cso_Result_SNOMED_Code_Primary,
            },
            ":SCode_Secondary": {
              S: fhirPayload.Cso_Result_SNOMED_Code_Secondary,
            },
            ":Result_Raw_Full_S3": {
              S: fhirPayload.Result_Raw_Full_S3,
            },
            ":Result_PDF_S3": {
              S: fhirPayload.Result_PDF_S3,
            },
            ":Result_Created_By": {
              S: fhirPayload.Result_Created_By,
            },
            ":Result_Creation": {
              S: fhirPayload.Result_Creation,
            },
            ":Result_Updated_By": {
              S: fhirPayload.Result_Updated_By,
            },
            ":Result_Updated": {
              S: fhirPayload.Result_Updated,
            },
            ":Cso_Result_Friendly_Primary": {
              S: fhirPayload.Cso_Result_Friendly_Primary,
            },
            ":Cso_Result_Friendly_Secondary": {
              S: fhirPayload.Cso_Result_Friendly_Secondary,
            },
            ":DiagnosticReportStatus": {
              S: fhirPayload.DiagnosticReportStatus,
            },
          },
        },
      },
    ],
  };

  try {
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
    console.error("Error: Transactional write failed:", error);
  }
};

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

/**
 * This function is used to remove any undefined values from the object so that
 * so that it can be passed into a ddb command without any errors
 *
 * @param {Object} obj Object to be formatted
 */
export const checkProperties = async (obj) => {
  for (var key in obj) {
    if (obj[key] != "") {
      console.log(`${key} populated.`);
    } else if (obj[key] == "" && Array.isArray(obj[key])) {
      obj[key] = ["NULL"];
    } else {
      obj[key] = "NULL";
    }
  }
};
