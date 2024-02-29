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
      const recordsAmended = uniqueRecords.map(async (record) => {
        nullCaasFields(record);
        const appointmentStatus = await hasAppointment(
          record.nhs_number,
          dbClient
        );
        if (appointmentStatus.Item) {
          updatePopulationTable(dbClient);
        }
      });
    }
  } catch {}
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
    console.log(`Failed to read from ${bucketName}/${key}`);
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

export const nullCaasFields = (record) => {
  record.address_line_1 = "null";
  record.address_line_2 = "null";
  record.address_line_3 = "null";
  record.address_line_4 = "null";
  record.address_line_5 = "null";
  record.postcode = "null";
  record.telephone_number = "null";
  record.mobile_number = "null";
  record.email_address = "null";
  record.primary_care_provider = "null";
  record.reason_for_removal = "ORR";
};

export const hasAppointment = (nhsNumber, client) => {};

export async function updatePopulationTable(client, personId) {
  const partitionKeyName = "PersonId";
  const partitionKeyValue = personId;

  const params = {
    TableName: `${ENVIRONMENT}-Population`,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression:
      "SET telephone_number_home = :null, telephone_number_mobile = :null, email_address_home = :null",
    ExpressionAttributeValues: {
      ":null": "null",
    },
  };

  const command = new GetItemCommand(params);
  const response = await client.send(command);
  return response;
}
