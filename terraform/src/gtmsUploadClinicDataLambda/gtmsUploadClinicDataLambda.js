import {
  GetObjectCommand,
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  BatchWriteItemCommand,
  UpdateItemCommand,
  QueryCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";

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

    const result = await checkPhlebotomy(
      js.ClinicCreateOrUpdate.ClinicID,
      client,
      ENVIRONMENT
    );
    if (result.Count) {
      if (result.Items[0].ClinicName === js.ClinicCreateOrUpdate.ClinicName)
        saveObjToPhlebotomyTable(js, ENVIRONMENT, client);
      //delete and put as ClinicName is sort key
      else {
        const clinicId = result.Items[0].ClinicId;
        const clinicName = result.Items[0].ClinicName;
        const deleteOldItem = await deleteTableRecord(
          client,
          ENVIRONMENT,
          clinicId,
          clinicName
        );

        if (deleteOldItem.$metadata.httpStatusCode === 200) {
          const updateResponse = await putTableRecord(client, ENVIRONMENT, js);
          if (updateResponse.$metadata.httpStatusCode !== 200) {
            const rejectedReason =
              "Error: Failed to insert item after delete. Save the message into a directory " +
              `${JSON.stringify(js)}`;
            const dateTime = new Date(Date.now()).toISOString();
            const key = `invalidData/invalidRecord_${dateTime}.json`;

            await pushCsvToS3(
              bucket,
              JSON.stringify(csvString),
              key,
              rejectedReason,
              s3
            );
          } else {
            console.log(
              `Successfully deleted and inserted item: ${JSON.stringify(js)}`
            );
          }
        } else {
          console.error(
            "Error: deleting and updating record with ClinicId " +
              clinicId +
              `${JSON.stringify(js)}`
          );
        }
      }
    } else {
      const response = await putTableRecord(client, ENVIRONMENT, js);

      if (response.$metadata.httpStatusCode !== 200) {
        const rejectedReason =
          "Error: Failed to insert item. Save the message into a directory  " +
          `${JSON.stringify(js)}`;
        const dateTime = new Date(Date.now()).toISOString();
        const key = `invalidData/invalidRecord_${dateTime}.json`;

        await pushCsvToS3(
          bucket,
          JSON.stringify(csvString),
          key,
          rejectedReason,
          s3
        );
      } else {
        console.log(`Successfully inserted item: ${JSON.stringify(js)}`);
      }
    }
  } catch (error) {
    console.error("Error: ", error);
  }
};

/**
 * Reads a CSV file from S3.
 *
 * @function readCsvFromS3
 * @async
 * @param {string} bucketName The name of the S3 bucket.
 * @param {string} key The key of the object in the S3 bucket.
 * @param {S3Client} client An instance of the S3 client.
 * @returns {Promise<string>} Resolves to the contents of the S3 object as a string.
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
 * Pushes a CSV file to S3.
 *
 * @function pushCsvToS3
 * @async
 * @param {string} bucketName The name of the S3 bucket.
 * @param {string} body The contents of the object to be saved in the S3 bucket.
 * @param {string} key The key of the object to be saved in the S3 bucket.
 * @param {string} rejectedReason Reason for rejection.
 * @param {S3Client} client An instance of the S3 client.
 * @returns {Promise<Object>} Resolves to the response from the S3 client.
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
    console.log(
      `Error: Failed to push to ${bucketName}/${key}. Error Message: ${err}`
    );
    throw err;
  }
};

/**
 * Creates a Phlebotomy Site object to be put in a DynamoDB table.
 *
 * @function createPhlebotomySite
 * @param {Object} site Object containing data about the site.
 * @returns {Promise<Object>} Put request object for a Phlebotomy site.
 */
export const createPhlebotomySite = (site) => {
  const item = {
    PutRequest: {
      Item: {
        ClinicId: {
          S: `${site.ClinicCreateOrUpdate.ClinicID}`,
        },
        ODSCode: {
          S: `${site.ClinicCreateOrUpdate.ODSCode}`,
        },
        ICBCode: {
          S: `${site.ClinicCreateOrUpdate.ICBCode}`,
        },
        ClinicName: {
          S: `${site.ClinicCreateOrUpdate.ClinicName}`,
        },
        Address: {
          S: `${site.ClinicCreateOrUpdate.Address}`,
        },
        Postcode: {
          S: `${site.ClinicCreateOrUpdate.Postcode}`,
        },
        Directions: {
          S: `${site.ClinicCreateOrUpdate.Directions}`,
        },
        TargetFillToPercentage: {
          N: `50`,
        },
        InvitesSent: {
          N: `0`,
        },
        LastSelectedRange: {
          N: `1`,
        },
        PrevInviteDate: {
          S: `null`,
        },
        Availability: {
          N: `0`,
        },
      },
    },
  };

  return Promise.resolve(item);
};

/**
 * Delete a table record from PhlebotomySite table with given clinicId and clinicName.
 *
 * @function deleteTableRecord
 * @async
 * @param {DynamoDBClient} client The DynamoDB client.
 * @param {string} environment The environment name.
 * @param {string} clinicId The clinic Id.
 * @param {string} clinicName The clinic name.
 * @returns {Promise<Object>} Response from deleting an item from DynamoDB.
 */
export const deleteTableRecord = async (
  client,
  environment,
  clinicId,
  clinicName
) => {
  const input = {
    Key: {
      ClinicId: { S: clinicId.S },
      ClinicName: { S: clinicName.S },
    },
    TableName: `${environment}-PhlebotomySite`,
  };

  const command = new DeleteItemCommand(input);
  const response = await client.send(command);

  return response;
};

/**
 * Put a table record into the Phlebotomy site table.
 *
 * @function putTableRecord
 * @async
 * @param {DynamoDBClient} client The DynamoDB client.
 * @param {string} environment The environment name.
 * @param {Object} js Object containing phlebotomy site information.
 * @returns {Promise<Object>} Response from putting an item in DynamoDB.
 */
export const putTableRecord = async (client, environment, js) => {
  const create = await createPhlebotomySite(js);
  let RequestItems = {};
  RequestItems[`${environment}-PhlebotomySite`] = [create];
  const command = new BatchWriteItemCommand({
    RequestItems: RequestItems,
  });
  const response = await client.send(command);

  return response;
};

/**
 * Update Phlebotomy site record
 *
 * @function saveObjToPhlebotomyTable
 * @async
 * @param {Object} MeshObj Object containing information to update record with.
 * @param {string} environment The environment name.
 * @param {DynamoDBClient} client The DynamoDB client.
 * @returns {Promise<boolean>} True if item is updated or false if failed to update.
 */
export const saveObjToPhlebotomyTable = async (
  MeshObj,
  environment,
  client
) => {
  const params = {
    Key: {
      ClinicId: {
        S: MeshObj["ClinicCreateOrUpdate"]["ClinicID"],
      },
      ClinicName: {
        S: MeshObj["ClinicCreateOrUpdate"]["ClinicName"],
      },
    },
    ExpressionAttributeNames: {
      "#ODSCode": "ODSCode",
      "#ICBCode": "ICBCode",
      "#Address": "Address",
      "#Postcode": "PostCode",
      "#Directions": "Directions",
    },
    ExpressionAttributeValues: {
      ":ODSCode_new": {
        S: MeshObj["ClinicCreateOrUpdate"]["ODSCode"],
      },
      ":ICBCode_new": {
        S: MeshObj["ClinicCreateOrUpdate"]["ICBCode"],
      },
      ":Address_new": {
        S: MeshObj["ClinicCreateOrUpdate"]["Address"],
      },
      ":Postcode_new": {
        S: MeshObj["ClinicCreateOrUpdate"]["Postcode"],
      },
      ":Directions_new": {
        S: MeshObj["ClinicCreateOrUpdate"]["Directions"],
      },
    },
    TableName: `${environment}-PhlebotomySite`,
    UpdateExpression:
      "SET #ODSCode = :ODSCode_new, #ICBCode = :ICBCode_new,  #Address = :Address_new, #Postcode = :Postcode_new, #Directions = :Directions_new",
  };

  const command = new UpdateItemCommand(params);
  try {
    const response = await client.send(command);
    if (response.$metadata.httpStatusCode !== 200) {
      console.error(`Error updating item: ${JSON.stringify(MeshObj)}`);
      return false;
    } else {
      console.log(`Successfully updated item: ${JSON.stringify(MeshObj)}`);
      return true;
    }
  } catch (error) {
    console.error(`Error: ${error}`);
  }
};

/**
 * Query to check a Phlebotomy site based on a given Clinic Id.
 *
 * @function checkPhlebotomy
 * @async
 * @param {string} record Clinic Id of Phlebotomy site.
 * @param {DynamoDBClient} client The DynamoDB client.
 * @param {string} environment The environment name.
 * @returns {Promise<Object>} Response from DynamoDB command.
 */
export async function checkPhlebotomy(record, client, environment) {
  const input = {
    ExpressionAttributeValues: {
      ":ClinicId": {
        S: `${record}`,
      },
    },
    KeyConditionExpression: "ClinicId = :ClinicId",
    TableName: `${environment}-PhlebotomySite`,
  };

  const command = new QueryCommand(input);
  const response = await client.send(command);

  return response;
}
