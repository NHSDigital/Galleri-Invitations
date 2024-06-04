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

  try {
    // Check if the TRR is in the 'Step 1 validated successfully bucket'
    if (trrJson.validationStep === "Step 1 validated successfully") {
      // Check if it's a CSD result (1854981000000108)
      if (trrJson.resultType === "1854981000000108") {
        // Check if only CSO1 exists in the TRR
        if (trrJson.CSO1 && !trrJson.CSO2) {
          const cso1Codes = trrJson.CSO1.snomedCodes;
          const cso1Match = await validateSnomedCodes(
            cso1Codes,
            "CancerSignalOrigin"
          );

          if (cso1Match) {
            // AC1: CSO1 matches approved combinations
            await uploadToS3(trrJson, "Step 2 validated successfully");
            await addS3ObjectTag(
              trrJson,
              "CSO1",
              cso1Match.participantFriendlyDescription
            );
          } else {
            // AC3: CSO1 does not match approved combinations
            await uploadToS3(trrJson, "Step 2 validated unsuccessful");
          }
        } else if (trrJson.CSO1 && trrJson.CSO2) {
          // Check if both CSO1 and CSO2 exist in the TRR
          const cso1Codes = trrJson.CSO1.snomedCodes;
          const cso2Codes = trrJson.CSO2.snomedCodes;
          const cso1Match = await validateSnomedCodes(
            cso1Codes,
            "CancerSignalOrigin"
          );
          const cso2Match = await validateSnomedCodes(
            cso2Codes,
            "CancerSignalOrigin"
          );

          if (cso1Match && cso2Match) {
            // AC2: Both CSO1 and CSO2 match approved combinations
            await uploadToS3(trrJson, "Step 2 validated successfully");
            await addS3ObjectTag(
              trrJson,
              "CSO1",
              cso1Match.participantFriendlyDescription
            );
            await addS3ObjectTag(
              trrJson,
              "CSO2",
              cso2Match.participantFriendlyDescription
            );
          } else {
            // AC4: One or both of CSO1 and CSO2 do not match approved combinations
            await uploadToS3(trrJson, "Step 2 validated unsuccessful");
          }
        }
      } else if (trrJson.resultType === "1854991000000105") {
        // AC5: No CSD result
        await uploadToS3(trrJson, "Step 2 validated successfully");
      }
    } else {
      console.log("TRR is not in the 'Step 1 validated successfully bucket'");
    }
  } catch (error) {
    console.error(
      `Error: processing object ${key} in bucket ${bucket}: ${error}`
    );
  }
};

// Helper functions
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

export const uploadToS3 = async (trrJson, destinationBucket) => {
  try {
    const jsonString = JSON.stringify(trrJson);
    await pushToS3(
      `${ENVIRONMENT}-${destinationBucket}`,
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
      Bucket: `${ENVIRONMENT}-Step 2 validated successfully`,
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
      FilterExpression: "SNOMED_Codes = :snomedCodes",
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
