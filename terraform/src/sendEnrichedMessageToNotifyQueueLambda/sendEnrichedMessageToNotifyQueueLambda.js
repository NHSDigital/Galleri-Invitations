//IMPORTS
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { format } from 'date-fns';

//VARIABLES
const ENVIRONMENT = process.env.ENVIRONMENT;
const sqs = new SQSClient({});
const dynamodb = new DynamoDBClient({region: "eu-west-2"});
const ssm = new SSMClient();
const participantIdField = 'Participant_Id';
const clinicIdField = 'Clinic_Id';
const appointmentDateTimeField = 'Appointment_Date_Time';
const phlebotomySiteClinicIdField = 'ClinicId';
const phlebotomySiteClinicName = 'ClinicName';
const phlebotomySiteAddress = 'Address';
const phlebotomySitePostcode = 'PostCode';
const phlebotomySiteDirections = 'Directions';

//HANDLER
export const handler = async (event) => {
  try {
    const batchOfMessages = event.Records;
    await processRecords(batchOfMessages, sqs, dynamodb, ssm, ENVIRONMENT)
  } catch (error) {
    console.error('Error occurred whilst processing the batch of messages from SQS');
    console.error('Error:', error);
  };
};

//FUNCTIONS
export async function processRecords(records, sqsClient, dynamoDbClient, ssmClient, environment) {
  const totalRecords = records.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSend = 0;

  for (let record of records) {
    try {
      const messageBody = JSON.parse(record.body);

      // Retrieve tables and routing Id from SSM Parameter store
      const eventType = formatEpisodeType(messageBody.episodeEvent);
      const tables = await getParameterValue(`${eventType}-tables`,ssmClient);
      const routingId = await getParameterValue(`${eventType}-routing-id`,ssmClient);

      if (routingId == 'Null' || routingId == 'Unavailable') {
        throw new Error(`RoutingId for event ${eventType} is returned as ${routingId}, processing of message stopped.`);
      }

      const enrichedMessage = await enrichMessage(messageBody,tables,routingId,dynamoDbClient,environment);

      await sendMessageToQueue(enrichedMessage,record,process.env.ENRICHED_MESSAGE_QUEUE_URL,sqsClient);

      await deleteMessageInQueue(messageBody,record,process.env.RAW_MESSAGE_QUEUE_URL,sqsClient);

      recordsSuccessfullySent++;
    } catch (error) {
      recordsFailedToSend++;
      console.error('Error:', error);
    }
  }

  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSend}`);
};

export async function enrichMessage(message,tables,routingId,dynamoDbClient,environment) {
// Enrich message
message.routingId = routingId;

if(tables.includes('appointment')) {
  // Retrieve relevant fields from DynamoDB
  const participantId = message.participantId;

  try {
    const appointmentsQueryResponse = await queryTable(dynamoDbClient,'Appointments',participantIdField,participantId,environment);
    const latestAppointment = appointmentsQueryResponse.sort((a,b) => {
      return new Date(b.Appointment_Date_Time.S) - new Date(a.Appointment_Date_Time.S);
    })[0];
    const appointmentDate = new Date(latestAppointment[appointmentDateTimeField].S);

    message.appointmentDateLong = format(appointmentDate, 'eeee dd MMMM yyyy');
    message.appointmentDateShort = format(appointmentDate, 'dd/MM/yyyy');
    message.appointmentTime = format(appointmentDate, 'hh:mmaaa');

    if(tables.includes('phlebotomy')) {
      const clinicId = latestAppointment[clinicIdField].S;
      const phlebotomySiteQueryResponse = await queryTable(dynamoDbClient,'PhlebotomySite',phlebotomySiteClinicIdField,clinicId,environment);

      message.clinicName = phlebotomySiteQueryResponse[0][phlebotomySiteClinicName].S;
      message.clinicAddress = phlebotomySiteQueryResponse[0][phlebotomySiteAddress].S;
      message.clinicPostcode = phlebotomySiteQueryResponse[0][phlebotomySitePostcode].S;
      message.clinicDirections = phlebotomySiteQueryResponse[0][phlebotomySiteDirections].S;
    }

    return message;
  } catch (error) {
    console.error('Error: Error querying DynamoDB');
    throw error;
  }
} else {
  return message;
}
};

export async function sendMessageToQueue(message,record,queue,sqsClient) {
  const sendMessageCommand = new SendMessageCommand({
    QueueUrl: queue,
    MessageBody: JSON.stringify(message),
    MessageGroupId: 'enrichedMessage'
});

try {
  await sqsClient.send(sendMessageCommand);
  console.log(`Sent enriched message with participant Id: ${message.participantId} to the enriched message queue.`);
} catch (error) {
  console.error(`Error: Failed to send message: ${record.messageId}`);
  throw error;
}
};

export async function deleteMessageInQueue(message,record,queue,sqsClient) {
  const deleteMessageCommand = new DeleteMessageCommand({
    QueueUrl: queue,
    ReceiptHandle: record.receiptHandle
  });

  try {
    await sqsClient.send(deleteMessageCommand);
    console.log(`Deleted message with participant Id: ${message.participantId} from the raw message queue.`);
  } catch (error) {
    console.error(`Error: Failed to delete message: ${record.messageId}`);
    throw error;
  }
}

export async function queryTable(dynamoDbClient,tableName,pKeyField,pKeyValue,environment) {
  const params = {
    TableName: `${environment}-${tableName}`,
    KeyConditionExpression: `${pKeyField} =:pk`,
    ExpressionAttributeValues: {
      ":pk": { S: pKeyValue },
  }
  };

  try {
    const queryCommand = new QueryCommand(params);
    const response = await dynamoDbClient.send(queryCommand);
    if (response.Items.length === 0) {
      throw new Error(`No items returned when querying ${tableName} with value ${pKeyValue}`);
    }
    return response.Items;
  } catch (error) {
    console.error(`Error: Error with querying the DynamoDB table ${tableName}`);
    throw error;
  }
};

// Converts the Episode Type given by the message from the queue into a format used to lookup the event in the parameter store
export function formatEpisodeType(type) {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-)|(-$)/g, "");
};

export async function getParameterValue(parameterName,ssmClient) {
  const params = {
    Name: parameterName,
    WithDecryption: true
  };

  try {
    const response = await ssmClient.send(new GetParameterCommand(params));
    return response.Parameter.Value;
  } catch (error) {
    console.error(`Error: Error retrieving parameter ${parameterName}`);
    throw error;
  }
};
