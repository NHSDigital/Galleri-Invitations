import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
const dbClient = new DynamoDBClient();
const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);

  const appointmentString = await readFromS3(bucket, key, s3);
  const appointmentJson = JSON.parse(appointmentString);
  const { Appointment } = appointmentJson;
  const {
    ParticipantID,
    AppointmentID,
    BloodCollectionDate,
    GrailID,
    BloodNotCollectedReason,
    eventType,
  } = Appointment;
  const episodeResponse = await lookUp(
    dbClient,
    ParticipantID,
    "Episode",
    "Participant_Id",
    "S",
    true
  );
  const episodeItems = episodeResponse.Items;

  try {
    let episodeEvent = "";
    switch (eventType) {
      case "COMPLETE":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Appointment Attended - Sample Taken";
        if (BloodCollectionDate && GrailID) {
          transactionalWrite(
            dbClient,
            ParticipantID,
            episodeItems.Batch_Id,
            AppointmentID,
            eventType,
            episodeEvent
          );
        }
        break;
      case "NO_SHOW":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Did Not Attend Appointment";
        transactionalWrite(
          dbClient,
          ParticipantID,
          episodeItems.Batch_Id,
          AppointmentID,
          eventType,
          episodeEvent
        );
        break;
      case "ABORTED":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Appointment Attended - No Sample Taken";
        if (BloodNotCollectedReason) {
          transactionalWrite(
            dbClient,
            ParticipantID,
            episodeItems.Batch_Id,
            AppointmentID,
            eventType,
            episodeEvent,
            BloodNotCollectedReason
          );
        }
        break;
      default:
        console.Error(
          `This was a ${eventType}, which is not an expected Event Type`
        );
        break;
    }
  } catch (error) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${error}`;
    console.error(message);
    throw new Error(message);
  }
};

//METHODS
export const extractStringFromFilepath = async (filepath) => {
  const regex = /valid_records-([^-]+)-([^.]+)\.json/;
  const match = filepath.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
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
// Updates Episode and appointment
const transactionalWrite = async (
  client,
  participantId,
  batchId,
  appointmentId,
  eventType,
  episodeEvent,
  eventDescription = "Null"
) => {
  const timeNow = String(Date.now());

  const params = {
    TransactItems: [
      {
        Update: {
          TableName: `${ENVIRONMENT}-Episode`,
          Key: {
            Batch_Id: batchId,
            Participant_Id: participantId,
          },
          UpdateExpression:
            "SET Episode_Event = :episodeEvent, Episode_Event_Updated = :time, Episode_Event_Description = :eventDescription Episode_Status = :open, Episode_Event_Notes = :null Episode_Event_Updated_By = :gtms, Episode_Status_Updated = :time",
          ExpressionAttributeValues: {
            ":episodeEvent": episodeEvent,
            ":time": timeNow,
            ":eventDescription": eventDescription,
            ":open": "Open",
            ":null": "Null",
            ":gtms": "GTMS",
          },
        },
      },
      {
        Update: {
          TableName: `${ENVIRONMENT}-Appointments`,
          Key: {
            Participant_Id: participantId,
            Appointment_Id: appointmentId,
          },
          UpdateExpression: "SET event_type = :eventType",
          ExpressionAttributeValues: {
            ":eventType": eventType,
          },
        },
      },
    ],
  };

  try {
    await client.transactWrite(params).promise();
    console.log("Transactional write succeeded");
  } catch (error) {
    console.error("Transactional write failed:", error);
  }
};

//In the Event that the we need to update the episode table.

//Complete
// Appointment EventType = COMPLETE
// Episode Event = Appointment Attended - Sample Taken xx
// Episode Event updated = current system date timestamp
// Episode event description = NULL
// Episode event notes = NULL
// Episode event updated by = GTMS
// Episode status = Open
// Episode status updated = same as episode event updated xx

//NO_SHOW
// Appointment EventType = NO_SHOW
// Episode Event = Did Not Attend Appointment xx
// Episode Event updated = current system date timestamp
// Episode event description = NULL
// Episode event notes = NULL
// Episode event updated by = GTMS
// Episode status = Open
// Episode status updated = same as episode event updated xx

//ABORTED
// Appointment = ABORTED
// Episode Event = Appointment Attended – No Sample Taken xx
// Episode Event updated = current system date timestamp
// Episode event description = BloodNotCollectedReason
// Episode event notes = NULL
// Episode event updated by = GTMS
// Episode status = Open
// Episode status updated = same as episode event updated xx

// {"Appointment" :{
//   "ParticipantID": "NHS-AB12-CD34",
//   "AppointmentID": "00000000-0000-0000-0000-000000000000",
//   "ClinicID": "D7E-G2H",
//   "AppointmentDateTime": "2006-01-02T15:04:05Z",
//   "BloodCollectionDate": "2006-01-02",
//   "PrimaryPhoneNumber": "01999999999",
//   "SecondaryPhoneNumber": "01999999999",
//   "Email": "me@example.com",
//   "Replaces": "",
//   "CancellationReason": "OTHER",
//   "Channel": "ONLINE",
//   "BloodNotCollectedReason": "PARTICIPANT_DECISION",
//   "EventType": "BOOKED",
//   "AppointmentAccessibility": {
//       "accessibleToilet": false,
//       "disabledParking": false,
//       "inductionLoop": false,
//       "signLanguage": false,
//       "stepFreeAccess": false,
//       "wheelchairAccess": false
//   },
//   "CommunicationAccessibility": {
//       "signLanguage": false,
//       "braille": false,
//       "interpreter": true,
//       "language": "ARABIC"
//     },
//   "NotificationPreferences": {
//       "canSMS": false,
//       "canEmail": false
//     },
//   "GrailID": "NHS0000000",
//   "InvitationNHSNumber": "0000000000",
//   "PDSNHSNumber": "0000000000",
//   "DateOfBirth": "2024-01-01",
// }
// }
