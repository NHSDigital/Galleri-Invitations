import { processMessage } from "../../gtmsMeshMailboxLambda/gtmsMeshMailboxLambda";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { pushCsvToS3, getSecret, run } from "../../gtmsMeshMailboxLambda/helper";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { handShake } from "nhs-mesh-client";
import mockAxios from "axios"


describe("pushCsvToS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successful response from sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await pushCsvToS3(
      "galleri-caas-data",
      "test.csv",
      "arr",
      mockS3Client
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Successfully pushed to galleri-caas-data/test.csv`);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });

  test("Failure when depositing to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Failed to push to S3");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushCsvToS3(
        "galleri-caas-data",
        "test.csv",
        "arr",
        mockS3Client
      );
    } catch (err) {
      expect(err.message).toBe("Failed to push to S3");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Failed: Error: Failed to push to S3');
  });
})


describe("getSecret", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successfully retrieve secret from secret manager", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const smClient = mockClient(SecretsManagerClient);


    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: 'my_secret_value' }),
    });
    const sm = new SecretsManagerClient({});
    const result = await sm.send(new GetSecretValueCommand({ "SecretId": "MESH_SENDER_CERT" }));
    expect(result.SecretString).toBe('{"my_secret_key":"my_secret_value"}');

    const smClient2 = mockClient(SecretsManagerClient);
    smClient2.resolves({});
    const response = await getSecret("MESH_SENDER_CERT", smClient2);
    // console.log(response);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Retrieved value successfully MESH_SENDER_CERT`);
  })

  test("Failure when retrieving secret", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Failed to retrieve secret to S3");
    const smClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      const response = await getSecret("MESH_SENDER_CERT", smClient);
    } catch (error) {
      expect(error.message).toBe("Failed to retrieve secret to S3");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Failed: Error: Failed to retrieve secret to S3');
  });
})

describe("processMessage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("successfully identify clinicCreateOrUpdate, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      ClinicCreateOrUpdate: {
        ClinicName: 'GRAIL Test Clinic',
        Address: '210 Euston Rd, London NW1 2DA',
        Postcode: 'SO42 7BZ'
      }
    };
    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-clinic-create-or-update/clinic_create_or_update_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify Appointments, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "Appointment": {
        "ParticipantID": "NHS-AB12-CD34",
        "AppointmentID": "00000000-0000-0000-0000-000000000000",
        "ClinicID": "D7E-G2H",
        "AppointmentDateTime": "2006-01-02T15:04:05.000Z",
        "BloodCollectionDate": "2006-01-02",
        "PrimaryPhoneNumber": "01999999999",
        "SecondaryPhoneNumber": "01999999999",
        "Email": "me@example.com"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-appointment/appointment_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify ClinicScheduleSummary, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "ClinicScheduleSummary": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-clinic-schedule-summary/clinic_schedule_summary_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify InvitedParticipantBatch, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "InvitedParticipantBatch": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-invited-participant-batch/invited_participant_batch_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify Withdrawal, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "Withdrawal": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-withdrawal/withdrawal_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify SiteAccessibilityOptions, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "SiteAccessibilityOptions": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-site-accessibility-options/site_accessibility_options_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify CommunicationAccessibility, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "CommunicationAccessibility": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-communication-accessibility/communication_accessibility_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify InterpreterLanguage, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "InterpreterLanguage": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-interpreter-language/interpreter_language_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })

  test("successfully identify NotificationPreferences, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = 'dev-1';
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      "NotificationPreferences": {
        "test_data": "example"
      }
    };

    const result = await processMessage(clinicData, environment, mockS3Client, 29012024);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(1, `Successfully pushed to dev-1-gtms-notification-preferences/notification_preferences_29012024.json`);
    expect(logSpy).toHaveBeenNthCalledWith(2, { "$metadata": { "httpStatusCode": 200 } });
  })
})

describe('run', () => {
  // jest.spyOn(mock, "log");
  // const mockConfig = {
  //   url: "example",
  //   mailboxID: "example",
  //   mailboxPassword: "example",
  //   sharedKey: "example",
  //   agent: "example"
  // };

  // jest.mock('nhs-mesh-client', () => ({
  //   //   handShake: jest.fn(() => { status: "Handshake successful, status 200" }),
  //   ...jest.requireActual('nhs-mesh-client'),
  //   // handShake: jest.fn(({ a, b, c, d, e }) => { response: "Handshake successful, status 200" })
  //   handShake: jest.fn(mockConfig).mockedResolvedValue({ response: "Handshake successful, status 200" })
  //   // handShake: jest.fn()
  // }))

  jest.mock('nhs-mesh-client', () =>
    Promise.resolve({
      handShake: () => Promise.resolve({}),
    })
  );

  // jest.mock('axios', () => ({
  //   get: jest.fn().mockedResolvedValue({ data: { response: "hello" } })
  // }))
  // expect(get).toHaveBeenCalledTimes(1);
  // jest.mock('../../gtmsMeshMailboxLambda/helper', () => {
  //   run: jest.fn().mockResolvedValue({ status: 200 })
  // })
  // handShake: jest.fn(() => { status: "Handshake successful, status 200" });
  // handShake = jest
  //   .fn()
  //   .mockResolvedValue({ status: "Handshake successful, status 200" });
  test.only('test run', async () => {
    // handShake.resolves({ status: "Handshake successful, status 200" });
    // expect(jest.isMockFunction(handShake)).toBeTruthy();
    // expect(handShake()).toBe("Handshake successful, status 200");
    // jest.mock('nhs-mesh-client');
    // handShake.mockImplementation(() => { status: "Handshake successful, status 200" });
    const config = {
      url: "example",
      mailboxID: "example",
      mailboxPassword: "example",
      sharedKey: "example",
      agent: "example"
    };
    // expect(await run(config, handShake)).toBe("Handshake successful, status 200");
    expect(await handShake(config)).toBe("Handshake successful, status 200");

  })
});
