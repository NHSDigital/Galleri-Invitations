import {
  DynamoDBClient,
  TransactWriteItemsCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const trrString = await readFromS3(bucket, key, s3);
  const trrJson = JSON.parse(trrString);
  const { entry } = trrJson;

  try {
    // Find the entry with the "Multi-cancer early detection signal detected" result
    const csdResult = entry.find(
      (entry) =>
        entry.resource.resourceType === "Observation" &&
        entry.resource.valueCodeableConcept &&
        entry.resource.valueCodeableConcept.coding.some(
          (coding) =>
            coding.code === "1854981000000108" ||
            coding.code === "1854991000000105"
        )
    );

    if (csdResult === "1854981000000108") {
      // Find the entry with the highest scored cancer signal origin (CSO1)
      const cso1 = entry.find(
        (entry) =>
          entry.resource.resourceType === "Observation" &&
          entry.resource.code.coding.some(
            (coding) =>
              coding.display ===
              "Multi-cancer early detection highest scored cancer signal origin by machine learning-based classifier"
          )
      );

      if (cso1) {
        const cso1Codes = cso1.resource.component.map(
          (component) => component.valueCodeableConcept.coding[0].code
        );
        const cso1Match = await validateSnomedCodes(
          cso1Codes,
          "CancerSignalOrigin"
        );

        if (cso1Match) {
          // AC1: CSO1 matches approved combinations
          await uploadToS3(
            trrJson,
            "inbound_nrds_galleritestresult_step2_success"
          );
          await addS3ObjectTag(
            trrJson,
            "CSO1",
            cso1Match.participantFriendlyDescription
          );
        } else {
          // AC3: CSO1 does not match approved combinations
          await uploadToS3(
            trrJson,
            "inbound_nrds_galleritestresult_step2_error"
          );
        }
      }

      // Find the entry with the second highest scored cancer signal origin (CSO2)
      const cso2 = entry.find(
        (entry) =>
          entry.resource.resourceType === "Observation" &&
          entry.resource.code.coding.some(
            (coding) =>
              coding.display ===
              "Multi-cancer early detection second highest scored cancer signal origin by machine learning-based classifier"
          )
      );

      if (cso2) {
        const cso2Codes = cso2.resource.component.map(
          (component) => component.valueCodeableConcept.coding[0].code
        );
        const cso2Match = await validateSnomedCodes(
          cso2Codes,
          "CancerSignalOrigin"
        );

        if (cso1Match && cso2Match) {
          // AC2: Both CSO1 and CSO2 match approved combinations
          await uploadToS3(
            trrJson,
            "inbound_nrds_galleritestresult_step2_success"
          );
          await addS3ObjectTag(trrJson, "CSO1", cso1Match.Cso_Result_Friendly);
          await addS3ObjectTag(trrJson, "CSO2", cso2Match.Cso_Result_Friendly);
        } else {
          // AC4: One or both of CSO1 and CSO2 do not match approved combinations
          await uploadToS3(
            trrJson,
            "inbound_nrds_galleritestresult_step2_success"
          );
        }
      }
    } else {
      // AC5: No CSD result
      await uploadToS3(trrJson, "inbound_nrds_galleritestresult_step2_error");
    }
  } catch (error) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${error}`;
    console.error(message);
    throw new Error(message);
  }
};

export const readFromS3 = async (bucketName, key, client) => {
  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    return response.Body.transformToString();
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const uploadToS3 = async (trrJson, bucket) => {
  try {
    const jsonString = JSON.stringify(trrJson);
    await pushToS3(
      `${ENVIRONMENT}-${bucket}`,
      `${trrJson.id}.json`,
      jsonString,
      s3
    );
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const addS3ObjectTag = async (trrJson, tagKey, tagValue) => {
  try {
    await s3.putObjectTagging({
      Bucket: `${ENVIRONMENT}-inbound_nrds_galleritestresult_step2_success`,
      Key: `${trrJson.id}.json`,
      Tagging: {
        TagSet: [
          {
            Key: tagKey,
            Value: tagValue,
          },
        ],
      },
    });
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

export const validateSnomedCodes = async (
  snomedCodes,
  tableName = "CancerSignalOrigin"
) => {
  try {
    const params = {
      TableName: `${ENVIRONMENT}-${tableName}`,
      FilterExpression: "Cso_Result_Snomed_Code_Sorted = :snomedCodes",
      ExpressionAttributeValues: {
        ":snomedCodes": { S: JSON.stringify(snomedCodes) },
      },
    };

    const response = await dbClient.send(new QueryCommand(params));
    const items = response.Items;

    if (items.length > 0) {
      return items[0];
    } else {
      return null;
    }
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};
