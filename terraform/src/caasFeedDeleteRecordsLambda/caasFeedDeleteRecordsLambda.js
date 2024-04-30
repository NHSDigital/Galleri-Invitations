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

//METHODS
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

export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

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
  if (response.$metadata.httpStatusCode != 200) {
    console.error(`Error: record update failed for person ${partitionKeyValue}`);
  }
  return response.$metadata.httpStatusCode;
}

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
  if (response.$metadata.httpStatusCode != 200) {
    console.error(`Error: record update failed for person ${partitionKeyValue}`);
  }
  return response.$metadata.httpStatusCode;
}
