import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
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

    if (
      csdResult &&
      csdResult.resource.valueCodeableConcept.coding[0].code ===
        "1854981000000108"
    ) {
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
        const cso1Codes = cso1.resource.component
          .map((component) => component.valueCodeableConcept.coding[0].code)
          .sort()
          .join("-");

        const cso1Match = await validateSnomedCodes(
          cso1Codes,
          "CancerSignalOrigin"
        );

        if (cso1Match) {
          await uploadToS3(
            trrJson,
            "inbound-nrds-galleritestresult-step2-success"
          );
          await addS3ObjectTag(
            trrJson,
            "CSO1",
            cso1Match[0].Cso_Result_Friendly.S
          );
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
            const cso2Codes = cso2.resource.component
              .map((component) => component.valueCodeableConcept.coding[0].code)
              .sort()
              .join("-");

            const cso2Match = await validateSnomedCodes(
              cso2Codes,
              "CancerSignalOrigin"
            );

            if (cso2Match) {
              await addS3ObjectTag(
                trrJson,
                "CSO2",
                cso2Match[0].Cso_Result_Friendly.S
              );
            } else {
              await uploadToS3(
                trrJson,
                "inbound-nrds-galleritestresult-step2-error"
              );
            }
          }
        } else {
          await uploadToS3(
            trrJson,
            "inbound-nrds-galleritestresult-step2-error"
          );
        }
      }
    } else {
      await uploadToS3(trrJson, "inbound-nrds-galleritestresult-step2-success");
    }
  } catch (error) {
    console.error(
      `Error processing object ${key} in bucket ${bucket}: ${error}`
    );
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
    console.error("Error: ", err);
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
    console.error("Error: ", err);
    throw err;
  }
};

const sanitizeTagValue = (value) => {
  value.replace(`"`, "").substring(0, 128);
  return value.replace(",", " ");
};

export const addS3ObjectTag = async (trrJson, tagKey, tagValue) => {
  try {
    const sanitizedValue = sanitizeTagValue(String(tagValue));

    const params = {
      Bucket: `${ENVIRONMENT}-inbound-nrds-galleritestresult-step2-success`,
      Key: `${trrJson.id}.json`,
      Tagging: {
        TagSet: [
          {
            Key: tagKey,
            Value: sanitizedValue,
          },
        ],
      },
    };

    const command = new PutObjectTaggingCommand(params);
    const response = await s3.send(command);
  } catch (err) {
    console.error("Error: ", err);
    throw err;
  }
};

export const validateSnomedCodes = async (
  sortedJoinedSnomedCodes,
  tableName = "CancerSignalOrigin"
) => {
  try {
    const params = {
      TableName: `${ENVIRONMENT}-${tableName}`,
      KeyConditionExpression:
        "Cso_Result_Snomed_Code_Sorted = :sortedJoinedSnomedCodes",
      ExpressionAttributeValues: {
        ":sortedJoinedSnomedCodes": { S: sortedJoinedSnomedCodes },
      },
    };

    const response = await dbClient.send(new QueryCommand(params));
    const items = response.Items;

    if (items.length > 0) {
      console.log(`Match found for ${sortedJoinedSnomedCodes}`);
      return items;
    } else {
      console.error(`Error: No match found for ${sortedJoinedSnomedCodes}`);
      return null;
    }
  } catch (err) {
    console.error("Error: ", err);
    throw err;
  }
};

export const pushToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    return response;
  } catch (err) {
    console.error("Error: ", err);
    throw err;
  }
};
