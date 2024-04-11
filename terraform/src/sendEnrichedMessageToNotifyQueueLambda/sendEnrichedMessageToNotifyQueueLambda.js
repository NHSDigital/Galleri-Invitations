//IMPORTS
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { DynamoDBClient, QueryCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";

//VARIABLES
const ENVIRONMENT = process.env.ENVIRONMENT;
const sqs = new SQSClient({});
const dynamodb = new DynamoDBClient({region: "eu-west-2"});

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

        const params = {
          TableName: `${ENVIRONMENT}-Appointments`,
          KeyConditionExpression: 'Participant_Id =:pk',
          ExpressionAttributeValues: {
            ":pk": { S: participantId },
        }
        };

        const command = new QueryCommand(params);

        try {
          const response = await client.send(command);
          if (response.Items && response.Items.length > 0) {
            const firstItem = response.Items[0];
            const fieldValue = firstItem['Clinic_Id'].S; // Assuming it's a string type
            console.log(`Value of ${fieldName}: ${fieldValue}`);
            return fieldValue;
          } else {
              console.log("No item found");
              return null;
          }
        } catch (error) {
          console.error('Failed to access DynamoDB table');
          throw error;
        }

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
    } catch (error) {
      console.error('Error:', error);
    }
  }

  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSent}`);
};
