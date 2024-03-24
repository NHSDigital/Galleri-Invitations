//IMPORTS
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

//VARIABLES
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

//HANDLER
export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const csvString = await readCsvFromS3(bucket, key, s3);
  const js = JSON.parse(csvString); //convert string retrieved from S3 to object

  console.log(js);

  const cancelledByNHS = {
    CLINIC_CLOSED_DUE_TO_LACK_OF_STAFF: "CLINIC_CLOSED_DUE_TO_LACK_OF_STAFF",
    CLINIC_CLOSED_DUE_TO_LACK_OF_FACILITY: "CLINIC_CLOSED_DUE_TO_LACK_OF_FACILITY",
    CLINIC_CLOSED_DUE_TO_OTHER_REASON: "CLINIC_CLOSED_DUE_TO_OTHER_REASON",
  };

  const cancelledByParticipant = {
    CANT_FIND_A_SUITABLE_LOCATION: "CANT_FIND_A_SUITABLE_LOCATION",
    CANT_FIND_A_SUITABLE_DATE_TIME: "CANT_FIND_A_SUITABLE_DATE_TIME",
    WORK_FAMILY_COMMITMENTS: "WORK_FAMILY_COMMITMENTS",
    OTHER: "OTHER",
  }

  const partcipantWithdrawn = {
    NO_LONGER_LIVE_IN_THE_COUNTRY: "NO_LONGER_LIVE_IN_THE_COUNTRY",
    DONT_WANT_TO_TAKE_PART: "DONT_WANT_TO_TAKE_PART",
  }



  const ParticipantID = js?.['Appointment']?.['ParticipantID'];
  const AppointmentID = js?.['Appointment']?.['AppointmentID'];
  const CancellationReason = js?.['Appointment']?.['CancellationReason'];
  const EventType = js?.['Appointment']?.['EventType']; //CANCELLED
  console.log(EventType);
  const episodeResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Episode",
    "Participant_Id",
    "S",
    true
  );

  const episodeItems = episodeResponse.Items[0];
  console.log(`episodeItems: , ${JSON.stringify(episodeItems)}`);

  const appointmentResponse = await lookUp(
    dbClient,
    AppointmentID,
    "Appointments",
    "Appointment_Id",
    "S",
    true
  );

  const appointmentItems = appointmentResponse.Items[0];
  console.log(`appointmentItems: , ${JSON.stringify(appointmentItems)}`);

  if (episodeItems && appointmentItems && EventType === 'CANCELLED') { //if both queries are not undefined
    //exists
    console.log("Inside here");
    if (CancellationReason) { //cancellation reason is supplied
      console.log('supplied reason');
      console.log(Object.values(cancelledByNHS).includes(CancellationReason));
      if (Object.values(cancelledByNHS).includes(CancellationReason)) {
        const episodeEvent = 'Appointment Cancelled By NHS';
        console.log(episodeEvent);
        // Then update cancelled appointment for the supplied participant in appointment table
        // And update episode record for the participant
        // And episode latest event is set to Appointment Cancelled by NHS

        // Episode Event = Appointment Cancelled by NHS
        // Episode Event updated = current system date timestamp
        // Episode event description = CancellationReason
        // Episode event notes = NULL
        // Episode event updated by = GTMS
        // Episode status = Open
        // Episode status updated = same as episode event updated
        const response = await transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems['Batch_Id']['S'], //required PK for Episode update
          AppointmentID,
          EventType,
          episodeEvent, //Appointment Cancelled by NHS
          CancellationReason //reason its cancelled coming from payload
        );
        console.log(response);
        console.log("arrived here -abdul");
      }
      if (Object.values(cancelledByParticipant).includes(CancellationReason)) {
        // Then update cancelled appointment for the supplied participant in appointment table
        // And update episode record for the participant
        // And episode latest event is set to Appointment Cancelled by participant

        // Episode Event = Appointment Cancelled by participant
        // Episode Event updated = current system date timestamp
        // Episode event description = CancellationReason
        // Episode event notes = NULL
        // Episode event updated by = GTMS
        // Episode status = Open
        // Episode status updated = same as episode event updated
      }
      if (Object.values(partcipantWithdrawn).includes(CancellationReason)) {
        // Then update cancelled appointment for the supplied participant in appointment table
        // And update episode record for the participant
        // And episode latest event is set to Appointment Cancelled by Participant - Withdrawn

        // Episode Event = Appointment Cancelled by Participant - Withdrawn
        // Episode Event updated = current system date timestamp
        // Episode event description = CancellationReason
        // Episode event notes = NULL
        // Episode event updated by = GTMS
        // Episode status = Open
        // Episode status updated = same as episode event updated
      }
    }
  }
};

//FUNCTIONS
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
    console.log(`Failed to push to ${bucketName}/${key}. Error Message: ${err}`);
    throw err;
  }
};

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

const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  episodeEvent,
  cancellationReason,
) => {
  const timeNow = String(Date.now());
  const params = {
    TransactItems: [
      {
        Update: {
          Key: {
            Batch_Id: { S: batchId },
            Participant_Id: { S: participantId },
          },
          UpdateExpression: `SET Episode_Event = :episodeEvent, Episode_Event_Updated = :timeNow, Episode_Event_Description = :eventDescription, Episode_Status = :open, Episode_Event_Notes = :null, Episode_Event_Updated_By = :gtms, Episode_Status_Updated = :timeNow`,
          TableName: `${ENVIRONMENT}-Episode`,
          ExpressionAttributeValues: {
            ":episodeEvent": { S: episodeEvent },
            ":timeNow": { N: timeNow },
            ":eventDescription": { S: cancellationReason },
            ":open": { S: "Open" },
            ":null": { S: "Null" },
            ":gtms": { S: "GTMS" },
          },
        },
      },
      {
        Update: {
          Key: {
            Participant_Id: { S: participantId },
            Appointment_Id: { S: appointmentId },
          },
          UpdateExpression: `SET event_type = :eventType`,
          TableName: `${ENVIRONMENT}-Appointments`,
          ExpressionAttributeValues: {
            ":eventType": { S: eventType },
          },
        },
      },
    ],
  };

  try {
    const command = new TransactWriteItemsCommand(params);
    const response = await client.send(command);
    return true;
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
};
