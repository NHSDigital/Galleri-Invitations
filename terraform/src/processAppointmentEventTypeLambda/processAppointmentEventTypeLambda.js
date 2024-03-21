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
    BloodCollectionDate,
    GrailID,
    BloodNotCollectedReason,
  } = Appointment;
  const episodeResponse = await lookUp(
    dbClient,
    Appointment.ParticipantID,
    "Episode",
    "Participant_Id",
    "S",
    true
  );

  try {
    const eventType = await extractStringFromFilepath(key);
    let episodeEvent = "";
    switch (eventType) {
      case "COMPLETE":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Appointment Attended - Sample Taken";
        if (BloodCollectionDate && GrailID) {
          updateRecordOnEventType(
            dbClient,
            eventType,
            episodeResponse,
            episodeEvent
          );
        }
        break;
      case "NO_SHOW":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Did Not Attend Appointment";
        updateRecordOnEventType(
          dbClient,
          eventType,
          episodeResponse,
          episodeEvent
        );
        break;
      case "ABORTED":
        console.log(`This was a ${eventType}`);
        episodeEvent = "Appointment Attended - No Sample Taken";
        if (BloodNotCollectedReason) {
          updateRecordOnEventType(
            dbClient,
            eventType,
            episodeResponse,
            episodeEvent
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

export const updateRecordOnEventType = async (
  client,
  eventType,
  episodeResponse,
  episodeEvent,
  episodeEventDescription = "Null"
) => {
  updateAppointmentTable(client, ParticipantID, eventType);

  if (episodeRecordCheck.Items.length > 0) {
    const episodeRecord = episodeResponse.Items[0];
    const batchId = episodeRecord.Batch_Id.S;
    const participantId = episodeRecord.Participant_Id.S;

    const timeNow = Date.now();

    const updateEpisodeEvent = ["Episode_Event", "S", episodeEvent];
    const updateEpisodeEventUpdated = [
      "Episode_Event_Updated",
      "N",
      String(timeNow),
    ];
    const updateEpisodeStatus = ["Episode_Status", "S", "Open"];
    const updateEpisodeEventDescription = [
      "Episode_Event_Description",
      "S",
      episodeEventDescription,
    ];
    const updateEpisodeEventNotes = ["Episode_Event_Notes", "S", "NULL"];
    const updateEpisodeEventUpdatedBy = [
      "Episode_Event_Updated_By",
      "S",
      "GTMS",
    ];
    const updateEpisodeStatusUpdated = [
      "Episode_Status_Updated",
      "N",
      String(timeNow),
    ];

    await updateRecordInTable(
      client,
      "Episode",
      batchId,
      "Batch_Id",
      participantId,
      "Participant_Id",
      updateEpisodeEvent,
      updateEpisodeEventUpdated,
      updateEpisodeStatus,
      updateEpisodeEventDescription,
      updateEpisodeEventNotes,
      updateEpisodeEventUpdatedBy,
      updateEpisodeStatusUpdated
    );
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
// Updates Episode and appointment
export async function updateRecordInTable(
  client,
  table,
  partitionKey,
  partitionKeyName,
  sortKey,
  sortKeyName,
  ...itemsToUpdate
) {
  let updateItemCommandKey = {};
  updateItemCommandKey[partitionKeyName] = { S: `${partitionKey}` };
  updateItemCommandKey[sortKeyName] = { S: `${sortKey}` };

  let updateItemCommandExpressionAttributeNames = {};

  let updateItemCommandExpressionAttributeValues = {};

  let updateItemCommandExpressionAttributeValuesNested = {};

  let updateItemCommandUpdateExpression = `SET `;

  itemsToUpdate.forEach((updateItem, index) => {
    const [itemName, itemType, item] = updateItem;

    // ExpressionAttributeNames
    const localAttributeName = `#${itemName.toUpperCase()}`;
    updateItemCommandExpressionAttributeNames[localAttributeName] = itemName;

    const localItemName = `local_${itemName}`;

    // ExpressionAttributeValues
    updateItemCommandExpressionAttributeValuesNested = {
      ...updateItemCommandExpressionAttributeValuesNested,
      [itemType]: item,
    };
    updateItemCommandExpressionAttributeValues[`:${localItemName}`] =
      updateItemCommandExpressionAttributeValuesNested;

    // UpdateExpression
    if (index > 0) {
      updateItemCommandUpdateExpression += `,${localAttributeName} = :${localItemName}`;
    } else {
      updateItemCommandUpdateExpression += `${localAttributeName} = :${localItemName}`;
    }
  });

  const input = {
    ExpressionAttributeNames: updateItemCommandExpressionAttributeNames,
    ExpressionAttributeValues: updateItemCommandExpressionAttributeValues,
    Key: updateItemCommandKey,
    TableName: `${ENVIRONMENT}-${table}`,
    UpdateExpression: updateItemCommandUpdateExpression,
  };

  const command = new UpdateItemCommand(input);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${partitionKey}`);
  }
  return response.$metadata.httpStatusCode;
}

export const updateAppointmentTable = async (
  client,
  participantId,
  eventType,
  table = `${ENVIRONMENT}-Appointments`
) => {
  const partitionKeyName = "Participant_Id";
  const partitionKeyValue = participantId;

  const params = {
    TableName: table,
    Key: {
      [partitionKeyName]: partitionKeyValue,
    },
    UpdateExpression: "SET event_type = :eventType",
    ExpressionAttributeValues: {
      ":eventType": eventType,
    },
  };

  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.log(`record update failed for person ${partitionKeyValue}`);
  }
  return response.$metadata.httpStatusCode;
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
