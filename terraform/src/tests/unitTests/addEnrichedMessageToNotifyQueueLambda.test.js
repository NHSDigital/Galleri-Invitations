import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { queryTable, processRecords, formatEpisodeType } from '../../sendEnrichedMessageToNotifyQueueLambda/sendEnrichedMessageToNotifyQueueLambda';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const InputRecords = [
  {
    receiptHandle: 'receiptHandle2',
    body: '{"participantId":"NHS-EU44-JN48","nhsNumber":"9000232300","episodeEvent":"Appointment Booked Letter"}',
  },
  {
    receiptHandle: 'receiptHandle3',
    body: '{"participantId":"NHS-JL65-PZ85","nhsNumber":"9000089789","episodeEvent":"Appointment Booked Text"}',
  },
  {
    receiptHandle: 'receiptHandle4',
    body: '{"participantId":"NHS-DD72-EV47","nhsNumber":"9000031959","episodeEvent":"Appointment Rebooked Letter"}',
  },
  {
    receiptHandle: 'receiptHandle5',
    body: '{"participantId":"NHS-CV02-RM34","nhsNumber":"9000001763","episodeEvent":"Appointment Rebooked Text"}',
  },
  {
    receiptHandle: 'receiptHandle6',
    body: '{"participantId":"NHS-CV02-RM34","nhsNumber":"9000001763","episodeEvent":"Appointment Cancelled by NHS"}',
  },
  {
    receiptHandle: 'receiptHandle7',
    body: '{"participantId":"NHS-CV02-RM34","nhsNumber":"9000001763","episodeEvent":"Appointment Cancelled by Participant"}',
  },
  {
    receiptHandle: 'receiptHandle8',
    body: '{"participantId":"NHS-CV02-RM34","nhsNumber":"9000001763","episodeEvent":"Appointment Cancelled by Participant - Withdrawn"}',
  },
  {
    receiptHandle: 'receiptHandle1',
    body: '{"participantId":"NHS-PY70-FH15","nhsNumber":"9000203188","episodeEvent":"Invited"}',
  },
  {
    receiptHandle: 'receiptHandle9',
    body: '{"participantId":"NHS-CV02-RM34","nhsNumber":"9000001763","episodeEvent":"Withdrawn"}',
  },
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
      "S": '2024-04-20T10:30:00.000'
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
      "S": '2024-04-25T11:00:00.000'
    },
    Clinic_Id: {
      "S": 'clinic2'
    }
  },
  {
    Participant_Id: {
      "S": 'NHS-PY70-FH15',
    },
    Appointment_Id: {
      "S": '3'
    },
    Appointment_Date_Time: {
      "S": '2024-04-25T11:00:00.000'
    },
    Clinic_Id: {
      "S": 'clinic1'
    }
  },
  {
    Participant_Id: {
      "S": 'NHS-JL65-PZ85',
    },
    Appointment_Id: {
      "S": '4'
    },
    Appointment_Date_Time: {
      "S": '2024-04-25T11:00:00.000'
    },
    Clinic_Id: {
      "S": 'clinic2'
    }
  },
  {
    Participant_Id: {
      "S": 'NHS-DD72-EV47',
    },
    Appointment_Id: {
      "S": '5'
    },
    Appointment_Date_Time: {
      "S": '2024-04-25T11:00:00.000'
    },
    Clinic_Id: {
      "S": 'clinic1'
    }
  },
  {
    Participant_Id: {
      "S": 'NHS-CV02-RM34',
    },
    Appointment_Id: {
      "S": '6'
    },
    Appointment_Date_Time: {
      "S": '2024-04-25T11:00:00.000'
    },
    Clinic_Id: {
      "S": 'clinic2'
    }
  }
];

const ItemFromClinics = [
  {
    ClinicId: {
      "S": "clinic1"
    },
    ClinicName: {
      "S": "Phlebotomy clinic 1"
    },
    Address: {
      "S": "1 infelicity Street, Gondor MK42 9DJ"
    },
    Directions: {
      "S": "These will contain directions to the site"
    },
    PostCode: {
      "S": "MK42 9DJ"
    },
  },
  {
    ClinicId: {
      "S": "clinic2"
    },
    ClinicName: {
      "S": "Phlebotomy clinic 2"
    },
    Address: {
      "S": "1 unangry Road, Gondor TA1 2PX"
    },
    Directions: {
      "S": "These will contain directions to the site"
    },
    PostCode: {
      "S": "TA1 2PX"
    },
  }
];

describe('processRecords', () => {
  let mockDynamoDbClient;
  let mockSQSClient;
  let mockSSMClient;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockDynamoDbClient = mockClient(new DynamoDBClient({}));
    mockSQSClient = mockClient(new SQSClient({}));
    mockSSMClient = mockClient(new SSMClient());
  });

  afterEach(() => {
    mockDynamoDbClient.reset();
    mockSQSClient.reset();
    mockSSMClient.reset();
  });

  test('Successfully enriched message with appointment and clinic fields', async () => {
    let logSpy = jest.spyOn(global.console, "log");

    // Mocks for DynamoDB
    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-Appointments`,
      KeyConditionExpression: `Participant_Id =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'NHS-EU44-JN48' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: ItemsFromAppointments.slice(0,2),
    });

    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-PhlebotomySite`,
      KeyConditionExpression: `ClinicId =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'clinic2' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: [ItemFromClinics[1]],
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

    // Mocks for SSM client
    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'appointment-booked-letter-tables'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'appointment-booked-letter-tables',
        Value: 'appointment, phlebotomy',
        Type: "String",
      },
    });

    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'appointment-booked-letter-routing-id'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'appointment-booked-letter-routing-id',
        Value: '4c4c4c06-0f6d-465a-ab6a-ca358c2721b0',
        Type: "String",
      },
    });

    // Run function
    await processRecords([InputRecords[0]], mockSQSClient, mockDynamoDbClient, mockSSMClient, 'dev');

    // Expects
    const MessageSentToEnrichedQueue = JSON.parse(mockSQSClient.commandCalls(SendMessageCommand)[0].args[0].input.MessageBody);

    // Check message is enriched with the right appointment/clinic details
    expect(MessageSentToEnrichedQueue.participantId).toEqual('NHS-EU44-JN48');
    expect(MessageSentToEnrichedQueue.nhsNumber).toEqual('9000232300');
    expect(MessageSentToEnrichedQueue.episodeEvent).toEqual('Appointment Booked Letter');
    expect(MessageSentToEnrichedQueue.appointmentDateLong).toEqual("Thursday 25 April 2024");
    expect(MessageSentToEnrichedQueue.appointmentDateShort).toEqual("25/04/2024");
    expect(MessageSentToEnrichedQueue.appointmentTime).toEqual("11:00am");
    expect(MessageSentToEnrichedQueue.clinicName).toEqual("Phlebotomy clinic 2");
    expect(MessageSentToEnrichedQueue.clinicAddress).toEqual("1 unangry Road, Gondor TA1 2PX");
    expect(MessageSentToEnrichedQueue.clinicPostcode).toEqual("TA1 2PX");
    expect(MessageSentToEnrichedQueue.clinicDirections).toEqual("These will contain directions to the site");
    expect(MessageSentToEnrichedQueue.routingId).toEqual('4c4c4c06-0f6d-465a-ab6a-ca358c2721b0');

    // Check correct message has been deleted
    expect(mockSQSClient.commandCalls(DeleteMessageCommand)[0].args[0].input.ReceiptHandle).toEqual("receiptHandle2");

    expect(logSpy).toHaveBeenCalledWith('Sent enriched message with participant Id: NHS-EU44-JN48 to the enriched message queue.');
    expect(logSpy).toHaveBeenCalledWith('Deleted message with participant Id: NHS-EU44-JN48 from the raw message queue.');
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 1 - Records successfully processed/sent: 1 - Records failed to send: 0');
  });

  test('Successfully enrich message without personalisation', async () => {
    let logSpy = jest.spyOn(global.console, "log");

    // Mocks for DynamoDB
    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-Appointments`,
      KeyConditionExpression: `Participant_Id =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'NHS-PY70-FH15' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: ItemsFromAppointments.slice(0,2),
    });

    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-PhlebotomySite`,
      KeyConditionExpression: `ClinicId =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'clinic1' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: [ItemFromClinics[0]],
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

    // Mocks for SSM client
    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'invited-tables'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'invited-tables',
        Value: 'Null',
        Type: "String",
      },
    });

    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'invited-routing-id'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'invited-routing-id',
        Value: 'a91601f5-ed53-4472-bbaa-580f418c7091',
        Type: "String",
      },
    });

    // Run function
    await processRecords([InputRecords[7]], mockSQSClient, mockDynamoDbClient, mockSSMClient, 'dev');

    // Expects
    const MessageSentToEnrichedQueue = JSON.parse(mockSQSClient.commandCalls(SendMessageCommand)[0].args[0].input.MessageBody);

    // Check message is enriched with the right appointment/clinic details
    expect(MessageSentToEnrichedQueue.participantId).toEqual('NHS-PY70-FH15');
    expect(MessageSentToEnrichedQueue.nhsNumber).toEqual('9000203188');
    expect(MessageSentToEnrichedQueue.episodeEvent).toEqual('Invited');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('appointmentDateLong');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('appointmentDateShort');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('appointmentTime');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('clinicName');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('clinicAddress');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('clinicPostcode');
    expect(MessageSentToEnrichedQueue).not.toHaveProperty('clinicDirections');
    expect(MessageSentToEnrichedQueue.routingId).toEqual('a91601f5-ed53-4472-bbaa-580f418c7091');

    // Check correct message has been deleted
    expect(mockSQSClient.commandCalls(DeleteMessageCommand)[0].args[0].input.ReceiptHandle).toEqual("receiptHandle1");

    expect(logSpy).toHaveBeenCalledWith('Sent enriched message with participant Id: NHS-PY70-FH15 to the enriched message queue.');
    expect(logSpy).toHaveBeenCalledWith('Deleted message with participant Id: NHS-PY70-FH15 from the raw message queue.');
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 1 - Records successfully processed/sent: 1 - Records failed to send: 0');
  });

  test('Failed to enrich message due to no appointments for participant', async () => {
    let logSpy = jest.spyOn(global.console, "log");

    // Mocks for DynamoDB
    mockDynamoDbClient.on(QueryCommand, {
      TableName: `dev-Appointments`,
      KeyConditionExpression: `Participant_Id =:pk`,
      ExpressionAttributeValues: {
        ":pk": { S: 'NHS-JL65-PZ85' },
    }}).resolves({
      $metadata: { httpStatusCode: 200 },
      Items: [],
    });

    // Mocks for SSM client
    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'appointment-booked-text-tables'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'appointment-booked-text-tables',
        Value: 'appointment, phlebotomy',
        Type: "String",
      },
    });

    mockSSMClient.on(GetParameterCommand,
      {
        Name: 'appointment-booked-text-routing-id'
      }
    ).resolves({
      $metadata: { httpStatusCode: 200 },
      Parameter: {
        Name: 'appointment-booked-text-routing-id',
        Value: 'a91601f5-ed53-4472-bbaa-580f418c7091',
        Type: "String",
      },
    });

    // Run function
    await processRecords([InputRecords[1]], mockSQSClient, mockDynamoDbClient, mockSSMClient, 'dev');

    // Expects
    expect(mockSQSClient.commandCalls(DeleteMessageCommand).length).toEqual(0);
    expect(mockSQSClient.commandCalls(SendMessageCommand).length).toEqual(0);
    expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 1 - Records successfully processed/sent: 0 - Records failed to send: 1');
    });

    test('Successfully process multiple messages', async () => {
      let logSpy = jest.spyOn(global.console, "log");

      // Mocks for SSM client
      mockSSMClient.on(GetParameterCommand).resolves({
        $metadata: { httpStatusCode: 200 },
        Parameter: {
          Value: 'Null',
          Type: "String",
        },
      });

      mockSSMClient.on(GetParameterCommand).resolves({
        $metadata: { httpStatusCode: 200 },
        Parameter: {
          Value: 'a91601f5-ed53-4472-bbaa-580f418c7091',
          Type: "String",
        },
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
      await processRecords(InputRecords, mockSQSClient, mockDynamoDbClient, mockSSMClient, 'dev');

      // Expects
      expect(mockSQSClient.commandCalls(DeleteMessageCommand).length).toEqual(9);
      expect(mockSQSClient.commandCalls(SendMessageCommand).length).toEqual(9);
      expect(logSpy).toHaveBeenCalledWith('Total records in the batch: 9 - Records successfully processed/sent: 9 - Records failed to send: 0');
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

describe('formatEpisodeType', () => {
  test('Successfully format episode type from message for lookup', () => {
    const formattedValue = formatEpisodeType('Appointment Cancelled by Participant - Withdrawn');
    expect(formattedValue).toEqual('appointment-cancelled-by-participant-withdrawn');
  });
});
