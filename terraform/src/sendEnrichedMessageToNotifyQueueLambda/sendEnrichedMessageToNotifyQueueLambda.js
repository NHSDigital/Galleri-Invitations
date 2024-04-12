//IMPORTS
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { format } from 'date-fns';

//VARIABLES
const ENVIRONMENT = process.env.ENVIRONMENT;
const sqs = new SQSClient({});
const dynamodb = new DynamoDBClient({region: "eu-west-2"});
const ParticipantIdField = 'Participant_Id';
const ClinicIdField = 'Clinic_Id';
const AppointmentDateTimeField = 'Appointment_Date_Time';
const PhlebotomySiteClinicIdField = 'ClinicId';
const PhlebotomySiteClinicName = 'ClinicName';
const PhlebotomySiteAddress = 'Address';
const PhlebotomySitePostcode = 'PostCode';
const PhlebotomySiteDirections = 'Directions';

//HANDLER
export const handler = async (event) => {
  try {
    const batchOfMessages = event.Records;
    await processRecords(batchOfMessages, sqs)
  } catch (error) {
    console.error('Error occurred whilst processing the batch of messages from SQS');
    console.error('Error:', error);
  };
};

//FUNCTIONS
export async function processRecords(records, client) {
  const totalRecords = records.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSent = 0;

  for (let record of records) {
    try {
      const messageBody = JSON.parse(record.body);
      console.log(`Message: ${messageBody}`);

      // Retrieve episodeEvent parameters from parameter store
      const eventType = messageBody.episodeEvent;

      // <Retrieve from parameter store code>

      // Values I get back from parameter store - Dummy values for now
      const routingId = '841ebf60-4ffa-45d3-874b-b3e9db895c70';
      const tables = 'appointment,clinic';

      // Enrich message
      if(tables.includes('appointment') && tables.includes('clinic')) {
        // Retrieve relevant fields from DynamoDB
        const participantId = messageBody.participantId;

        try {
          // Appointments details
          const appointmentsParams = {
            TableName: `${ENVIRONMENT}-Appointments`,
            KeyConditionExpression: `${ParticipantIdField} =:pk`,
            ExpressionAttributeValues: {
              ":pk": { S: participantId },
          }
          };

          const appointmentsCommand = new QueryCommand(appointmentsParams);
          const appointmentsResponse = await dynamodb.send(appointmentsCommand);
          const clinicId = appointmentsResponse.Items[0][ClinicIdField].S; // Assuming it's a string type

          const appointmentDate = new Date(appointmentsResponse.Items[0][AppointmentDateTimeField].S);
          const appointmentDateLong = format(appointmentDate, 'eeee dd MMMM yyyy');
          const appointmentDateShort = format(appointmentDate, 'dd/MM/yyyy');
          const appointmentTime = format(appointmentDate, 'hh:mmaaa');

          messageBody.appointmentDateLong = appointmentDateLong;
          messageBody.appointmentDateShort = appointmentDateShort;
          messageBody.appointmentTime = appointmentTime;

          // Clinic details
          const phlebotomySiteParams = {
            TableName: `${ENVIRONMENT}-PhlebotomySite`,
            KeyConditionExpression: `${PhlebotomySiteClinicIdField} =:pk`,
            ExpressionAttributeValues: {
              ":pk": { S: clinicId },
          }
          };

          const phlebotomySiteCommand = new QueryCommand(phlebotomySiteParams);
          const phlebotomySiteResponse = await dynamodb.send(phlebotomySiteCommand);
          const clinicName = phlebotomySiteResponse.Items[0][PhlebotomySiteClinicName].S; // Assuming it's a string type
          const address = phlebotomySiteResponse.Items[0][PhlebotomySiteAddress].S;
          const postcode = phlebotomySiteResponse.Items[0][PhlebotomySitePostcode].S;
          const directions = phlebotomySiteResponse.Items[0][PhlebotomySiteDirections].S;

          messageBody.clinicName = clinicName;
          messageBody.clinicAddress = address;
          messageBody.clinicPostcode = postcode;
          messageBody.clinicDirections = directions;

        } catch (error) {
          console.error('Error querying DynamoDB');
          throw error;
        }

        messageBody.routingId = routingId;
      } else {
        messageBody.routingId = routingId;
      };

      // Send to notifyEnrichedMessageQueue
      const sendMessageCommand = new SendMessageCommand({
        QueueUrl: process.env.ENRICHED_MESSAGE_QUEUE_URL,
        MessageBody: JSON.stringify(messageBody),
        MessageGroupId: 'enrichedMessage'
      });

      try {
        await client.send(sendMessageCommand);
        console.log(`Sent enriched message with participant Id: ${messageBody.participantId} to the enriched message queue.`);
      } catch (error) {
        console.error(`Failed to send message: ${record.messageId}`);
        throw error;
      }

      // Delete message from notifyRawMessageQueue
      const deleteMessageCommand = new DeleteMessageCommand({
        QueueUrl: process.env.RAW_MESSAGE_QUEUE_URL,
        ReceiptHandle: record.receiptHandle
      });

      try {
        await client.send(deleteMessageCommand);
        console.log(`Deleted message with participant Id: ${messageBody.participantId} from the raw message queue.`);
      } catch (error) {
        console.error(`Failed to delete message: ${record.messageId}`);
        throw error;
      }

      recordsSuccessfullySent++;
    } catch (error) {
      console.error('Error:', error);
    }
  }

  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSent}`);
};
