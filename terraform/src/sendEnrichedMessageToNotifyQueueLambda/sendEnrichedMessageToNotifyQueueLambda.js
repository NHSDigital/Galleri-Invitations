//IMPORTS
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
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
    await processRecords(batchOfMessages, sqs, dynamodb)
  } catch (error) {
    console.error('Error occurred whilst processing the batch of messages from SQS');
    console.error('Error:', error);
  };
};

//FUNCTIONS
export async function processRecords(records, sqsClient, dynamoDbClient) {
  const totalRecords = records.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSend = 0;

  for (let record of records) {
    try {
      const messageBody = JSON.parse(record.body);

      // Retrieve episodeEvent parameters from parameter store
      const eventType = messageBody.episodeEvent;

      // <Retrieve from parameter store code>

      // Values I get back from parameter store - Dummy values for now
      const routingId = '841ebf60-4ffa-45d3-874b-b3e9db895c70';
      const tables = 'appointment,clinic';

      // Enrich message
      if(tables.includes('appointment')) {
        // Retrieve relevant fields from DynamoDB
        const participantId = messageBody.participantId;

        try {
          const appointmentsQueryResponse = await queryTable(dynamoDbClient,'Appointments',ParticipantIdField,participantId);
          const appointmentDate = new Date(appointmentsQueryResponse[0][AppointmentDateTimeField].S);

          messageBody.appointmentDateLong = format(appointmentDate, 'eeee dd MMMM yyyy');
          messageBody.appointmentDateShort = format(appointmentDate, 'dd/MM/yyyy');
          messageBody.appointmentTime = format(appointmentDate, 'hh:mmaaa');

          if(tables.includes('clinic')) {
            const clinicId = appointmentsQueryResponse[0][ClinicIdField].S;
            const phlebotomySiteQueryResponse = await queryTable(dynamoDbClient,'PhlebotomySite',PhlebotomySiteClinicIdField,clinicId);

            messageBody.clinicName = phlebotomySiteQueryResponse[0][PhlebotomySiteClinicName].S;
            messageBody.clinicAddress = phlebotomySiteQueryResponse[0][PhlebotomySiteAddress].S;
            messageBody.clinicPostcode = phlebotomySiteQueryResponse[0][PhlebotomySitePostcode].S;
            messageBody.clinicDirections = phlebotomySiteQueryResponse[0][PhlebotomySiteDirections].S;
          }

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
        await sqsClient.send(sendMessageCommand);
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
        await sqsClient.send(deleteMessageCommand);
        console.log(`Deleted message with participant Id: ${messageBody.participantId} from the raw message queue.`);
      } catch (error) {
        console.error(`Failed to delete message: ${record.messageId}`);
        throw error;
      }

      recordsSuccessfullySent++;
    } catch (error) {
      recordsFailedToSend++;
      console.error('Error:', error);
    }
  }

  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSend}`);
};

export async function queryTable(dynamoDbClient,tableName,pKeyField,pKeyValue) {
  const params = {
    TableName: `${ENVIRONMENT}-${tableName}`,
    KeyConditionExpression: `${pKeyField} =:pk`,
    ExpressionAttributeValues: {
      ":pk": { S: pKeyValue },
  }
  };

  try {
    const queryCommand = new QueryCommand(params);
    const response = await dynamoDbClient.send(queryCommand);
    return response.Items;
  } catch (error) {
    console.error(`Error with querying the DynamoDB table ${tableName}`);
    throw error;
  }
};
