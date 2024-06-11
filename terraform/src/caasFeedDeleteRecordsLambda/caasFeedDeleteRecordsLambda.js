import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import csv from "csv-parser";

const s3 = new S3Client();
const dbClient = new DynamoDBClient({
  region: "eu-west-2",
});
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  try {
    const csvString = await readCsvFromS3(bucket, key, s3);
    const records = await parseCsvToArray(csvString);
    const uniqueRecords = filterUniqueEntries(records);

    if (uniqueRecords.length > 0) {
      const recordsToUploadSettled = await Promise.allSettled(
        uniqueRecords.map(async (record) => {
          const participantIdResponse = await getParticipantId(
            dbClient,
            record.nhs_number
          );

          if (participantIdResponse.Items > 0) {
            const participantId = participantIdResponse.Item.Participant_Id.S;
            updatePopulationTable(dbClient, participantId);
            const appointmentStatus = await hasAppointment(
              dbClient,
              participantId
            );

            if (appointmentStatus.Items > 0) {
              updateAppointmentTable(dbClient, participantId);
            }
          } else {
            return {
              rejectedRecordNhsNumber: record.nhs_number,
              rejected: true,
              reason: `Rejecting record ${record.nhs_number}. Cannot update record as it doesn't exist in table`,
            };
          }
        })
      );
    }

    const filteredRejectedRecords = recordsToUploadSettled.filter((record) => {
      return !record?.rejected;
    });
    console.log(
      "----------------------------------------------------------------"
    );

    if (filteredRejectedRecords) {
      const timeNow = Date.now();
      const fileName = `validRecords/rejectedRecords/delete/rejectedRecords-${timeNow}.csv`;
      console.error(
        `Error: ${filteredRejectedRecords.length} records failed. A failure report will be uploaded to ${ENVIRONMENT}-${bucket}/${fileName}`
      );
      // Generate the CSV format
      const rejectedRecordsString = generateCsvString(
        `nhs_number,rejected,reason`,
        filteredRejectedRecords
      );

      await pushCsvToS3(`${bucket}`, `${fileName}`, rejectedRecordsString, s3);
    } else {
      console.log("No valid Caas Feed data to delete");
    }
  } catch (error) {
    console.error(
      "Error: with CaaS Feed extraction, procession or uploading",
      error
    );
  }
  return "Exiting Lambda";
};

/**
 * Reads a CSV file from S3.
 *
 * @function readCsvFromS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the object in the S3 bucket.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<string>} Resolves to the contents of the S3 object as a string.
 * @throws {Error} Will throw an error if reading from S3 fails.
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
 * Pushes a CSV file to S3.
 *
 * @function pushCsvToS3
 * @async
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} key - The key of the object to be saved in the S3 bucket.
 * @param {string} body - The contents of the object to be saved in the S3 bucket.
 * @param {S3Client} client - An instance of the S3 client.
 * @returns {Promise<Object>} Resolves to the response from the S3 client.
 * @throws {Error} Will throw an error if pushing to S3 fails.
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
 * Parses a CSV string into an array of objects.
 *
 * @function parseCsvToArray
 * @async
 * @param {string} csvString - The CSV string to parse.
 * @returns {Promise<Array<Object>>} Resolves to an array of parsed CSV records.
 * @throws {Error} Will throw an error if parsing the CSV fails.
 */
export const parseCsvToArray = async (csvString) => {
  const dataArray = [];

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(row);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

/**
 * Generates a CSV string from an array of objects.
 *
 * @function generateCsvString
 * @param {string} header - The header row for the CSV.
 * @param {Array<Object>} dataArray - The array of objects to convert to CSV.
 * @returns {string} The generated CSV string.
 */
export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

/**
 * Filters unique entries based on NHS number.
 *
 * @function filterUniqueEntries
 * @param {Array<Object>} caasFeed - The array of records to filter.
 * @returns {Array<Object>} An array of unique records.
 */
export const filterUniqueEntries = (caasFeed) => {
  const flag = {};
  const unique = [];

  caasFeed.forEach((el) => {
    if (!flag[el.nhs_number]) {
      flag[el.nhs_number] = true;
      unique.push(el);
    }
  });
  return unique;
};

/**
 * Retrieves the participant ID from the DynamoDB table.
 *
 * @function getParticipantId
 * @async
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {string} nhsNumber - The NHS number to look up.
 * @param {string} [table] - The name of the DynamoDB table.
 * @returns {Promise<Object>} Resolves to the response from DynamoDB.
 * @throws {Error} Will throw an error if the DynamoDB query fails.
 */
export async function getParticipantId(
  client,
  nhsNumber,
  table = `${ENVIRONMENT}-Population`
) {
  const gsiPartitionKeyName = "nhs_number";
  const gsiPartitionKeyValue = nhsNumber;

  const params = {
    TableName: table,
    IndexName: "nhs_number-index",
    KeyConditionExpression: "#gsiKey = :gsiValue",
    ExpressionAttributeNames: {
      "#gsiKey": gsiPartitionKeyName,
    },
    ExpressionAttributeValues: {
      ":gsiValue": gsiPartitionKeyValue,
    },
  };

  const command = new QueryCommand(params);
  const response = await client.send(command);
  return response;
}

/**
 * Checks if the participant has an appointment.
 *
 * @function hasAppointment
 * @async
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {string} participantId - The participant ID to look up.
 * @param {string} [table] - The name of the DynamoDB table.
 * @returns {Promise<Object>} Resolves to the response from DynamoDB.
 * @throws {Error} Will throw an error if the DynamoDB query fails.
 */
export async function hasAppointment(
  client,
  participantId,
  table = `${ENVIRONMENT}-Appointments`
) {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = participantId;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
  };

  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response;
}

/**
 * Updates the population table in DynamoDB.
 *
 * @function updatePopulationTable
 * @async
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {string} personId - The person ID to update.
 * @param {string} [table] - The name of the DynamoDB table.
 * @returns {Promise<number>} Resolves to the HTTP status code of the response.
 * @throws {Error} Will throw an error if the DynamoDB update fails.
 */
export async function updatePopulationTable(
  client,
  personId,
  table = `${ENVIRONMENT}-Population`
) {
  const partitionKeyName = "PersonId";
  const partitionKeyValue = personId;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression:
      "SET address_line_1 = :null, address_line_2 = :null, address_line_3 = :null, address_line_4 = :null, address_line_5 = :null, postcode = :null, telephone_number = :null, mobile_number = :null, email_address = :null, primary_care_provider = :null, nbo_comms = :true",
    ExpressionAttributeValues: {
      ":null": "null",
      ":true": true,
    },
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode !== 200) {
    console.error(
      `Error: record update failed for person ${partitionKeyValue}`
    );
  }
  return response.$metadata.httpStatusCode;
}

/**
 * Updates the appointment table in DynamoDB.
 *
 * @function updateAppointmentTable
 * @async
 * @param {DynamoDBClient} client - An instance of the DynamoDB client.
 * @param {string} participantId - The participant ID to update.
 * @param {string} [table] - The name of the DynamoDB table.
 * @returns {Promise<number>} Resolves to the HTTP status code of the response.
 * @throws {Error} Will throw an error if the DynamoDB update fails.
 */
export async function updateAppointmentTable(
  client,
  participantId,
  table = `${ENVIRONMENT}-Appointments`
) {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = participantId;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression: "SET telephone_number = :null, email_address = :null",
    ExpressionAttributeValues: {
      ":null": "null",
    },
  };

  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode !== 200) {
    console.error(
      `Error: record update failed for person ${partitionKeyValue}`
    );
  }
  return response.$metadata.httpStatusCode;
}
