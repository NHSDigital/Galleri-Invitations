import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { queryTable, processRecords } from '../../sendEnrichedMessageToNotifyQueueLambda/sendEnrichedMessageToNotifyQueueLambda';

describe('processRecords', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const mockSQSClient = mockClient(new SQSClient({}));
  const InputRecords = [
    {
      receiptHandle: 'receiptHandle123',
      body: '{"participantId":"NHS-EU44-JN48","nhsNumber":"9000203188","episodeEvent":"Invited"}',
    }
  ];

  const ItemsFromAppointments = [
    {
      Participant_Id: {
        "S": 'NHS-EU44-JN48'
      },
      Appointment_Id: {
        "S": '1'
      },
      Appointment_Date_Time:
      {
        "S": '2024-04-20T10:30:00.000Z'
      },
      Clinic_Id: {
        "S": 'clinic1'
      }
    },
    {
      Participant_Id: {
        "S": 'NHS-EU44-JN48',
      },
      Appointment_Id: {
        "S": '2'
      },
      Appointment_Date_Time: {
        "S": '2024-04-25T11:00:00.000Z'
      },
      Clinic_Id: {
        "S": 'clinic2'
      }
    }
  ];

  const ItemFromClinics = [
    {
      ClinicId: {
        "S": "clinic2"
      },
      ClinicName: {
        "S": "Phlebotomy clinic 1"
      },
      Address: {
        "S": "1 infelicity Street, Gondor MK42 9DJ"
      },
      Availability: {
        "N": "263"
      },
      Directions: {
        "S": "These will contain directions to the site"
      },
      PostCode: {
        "S": "MK42 9DJ"
      },
    }
  ];

  test('Successfully enriched message', async () => {
    const logSpy = jest.spyOn(global.console, "log");

    // Mocks for DynamoDB
    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-Appointments`,
      KeyConditionExpression: `Participant_Id =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'NHS-EU44-JN48' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: ItemsFromAppointments,
    });

    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-PhlebotomySite`,
      KeyConditionExpression: `ClinicId =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'clinic2' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: ItemFromClinics,
    });

    // Mock for SQS SendMessageCommand
    mockSQSClient.on(SendMessageCommand).resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: '123',
    });

    // Mock for SQS DeleteMessageCommand
    mockSQSClient.on(DeleteMessageCommand).resolves({
      $metadata: { httpStatusCode: 200 },
      MessageId: '456',
    });

    // Run function
    await processRecords(InputRecords, mockSQSClient, mockDynamoDbClient, 'dev');

    // Expects
    const MessageSentToEnrichedQueue = JSON.parse(mockSQSClient.commandCalls(SendMessageCommand)[0].args[0].input.MessageBody);
    console.log(MessageSentToEnrichedQueue);

    // Check message is enriched with the right appointment/clinic details
    expect(MessageSentToEnrichedQueue.participantId).toEqual('NHS-EU44-JN48');
    expect(MessageSentToEnrichedQueue.nhsNumber).toEqual('9000203188');
    expect(MessageSentToEnrichedQueue.episodeEvent).toEqual('Invited');
    expect(MessageSentToEnrichedQueue.appointmentDateLong).toEqual("Thursday 25 April 2024");
    expect(MessageSentToEnrichedQueue.appointmentDateShort).toEqual("25/04/2024");
    expect(MessageSentToEnrichedQueue.appointmentTime).toEqual("12:00pm");
    expect(MessageSentToEnrichedQueue.clinicName).toEqual("Phlebotomy clinic 1");
    expect(MessageSentToEnrichedQueue.clinicAddress).toEqual("1 infelicity Street, Gondor MK42 9DJ");
    expect(MessageSentToEnrichedQueue.clinicPostcode).toEqual("MK42 9DJ");
    expect(MessageSentToEnrichedQueue.clinicDirections).toEqual("These will contain directions to the site");
    expect(MessageSentToEnrichedQueue.routingId).toEqual('841ebf60-4ffa-45d3-874b-b3e9db895c70');

    // Check correct message has been deleted
    expect(mockSQSClient.commandCalls(DeleteMessageCommand)[0].args[0].input.ReceiptHandle).toEqual("receiptHandle123");

    expect(logSpy).toHaveBeenCalledWith('Sent enriched message with participant Id: NHS-EU44-JN48 to the enriched message queue.');
    expect(logSpy).toHaveBeenCalledWith('Deleted message with participant Id: NHS-EU44-JN48 from the raw message queue.');
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 1 - Records successfully processed/sent: 1 - Records failed to send: 0');
  });
});

describe('queryTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test('Successfully query table and return the appointment based on participant id', async () => {
    const Items = [
      {
        Participant_Id: 'NHS-EU44-JN48',
        Appointment_Id: '1',
        Appointment_Date_Time: '2024-04-20T10:30:00.000Z',
        Clinic_Id: 'YB85A123'
      },
      {
        Participant_Id: 'NHS-EU44-JN48',
        Appointment_Id: '2',
        Appointment_Date_Time: '2024-04-25T11:00:00.000Z',
        Clinic_Id: 'YB85A456'
      }
    ];

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: Items,
    });

    const queryResponse = await queryTable(mockDynamoDbClient, 'Appointments', 'Participant_Id', 'NHS-EU44-JN48');
    expect(queryResponse.length).toEqual(2);
  });

  test('No item returned from table', async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    try {
      await queryTable(mockDynamoDbClient, 'Appointments', 'Participant_Id', 'NHS-EU44-JN48');
    } catch(error) {
      expect(error.message).toEqual("No items returned when querying Appointments with value NHS-EU44-JN48");
    };
  });

  test('Error querying table', async () => {
    const mockInternalServerError = new Error('InternalServerError: DynamoDB encountered an internal server error');
    mockDynamoDbClient.on(QueryCommand).rejects(mockInternalServerError);

    try {
      await queryTable(mockDynamoDbClient, 'Appointments', 'Participant_Id', 'NHS-EU44-JN48');
    } catch(error) {
      expect(error.message).toEqual("InternalServerError: DynamoDB encountered an internal server error");
    };
  });
});
