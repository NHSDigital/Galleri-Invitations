import { processMessage } from "../../gtmsMeshMailboxLambda/gtmsMeshMailboxLambda";
import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  pushCsvToS3,
  getSecret,
  getHealthStatusCode,
  getMessageArray,
  markRead,
  readMsg,
} from "../../gtmsMeshMailboxLambda/helper";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  handShake,
  getMessageCount,
  markAsRead,
  readMessage,
} from "nhs-mesh-client";

jest.mock("nhs-mesh-client");
handShake.mockResolvedValue({ status: "Handshake successful, status 200" });
getMessageCount.mockResolvedValue({
  data: { messages: "123ID", approx_inbox_count: 1 },
});
markAsRead.mockResolvedValue("message cleared");
readMessage.mockResolvedValue({ nhs_num: "123", name: "bolo" });

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
    expect(logSpy).toHaveBeenCalledWith(
      `Successfully pushed to galleri-caas-data/test.csv`
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });

  test("Failure when depositing to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Failed to push to S3");
    const mockS3Client = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushCsvToS3("galleri-caas-data", "test.csv", "arr", mockS3Client);
    } catch (err) {
      expect(err.message).toBe("Failed to push to S3");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed: Error: Failed to push to S3");
  });
});

describe("getSecret", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successfully retrieve secret from secret manager", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const smClient = mockClient(SecretsManagerClient);

    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: "my_secret_value" }),
    });
    const sm = new SecretsManagerClient({});
    const result = await sm.send(
      new GetSecretValueCommand({ SecretId: "MESH_SENDER_CERT" })
    );
    expect(result.SecretString).toBe('{"my_secret_key":"my_secret_value"}');

    const smClient2 = mockClient(SecretsManagerClient);
    smClient2.resolves({});
    const response = await getSecret("MESH_SENDER_CERT", smClient2);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Retrieved value successfully MESH_SENDER_CERT`
    );
  });

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
    expect(logSpy).toHaveBeenCalledWith(
      "Failed: Error: Failed to retrieve secret to S3"
    );
  });
});

describe("processMessage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  const workflows = {
    CLINIC_WORKFLOWID: "GTMS_CLINIC",
    CLINIC_SCHEDULE_WORKFLOWID: "GTMS_CLINIC_SCHEDULE",
    APPOINTMENT_WORKFLOWID: "GTMS_APPOINTMENT",
    WITHDRAW_WORKFLOWID: "GTMS_WITHDRAW",
  };

  test("successfully identify clinicCreateOrUpdate, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const environment = "dev-1";
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicData = {
      initial_response: {
        headers: {
          "mex-workflowid": "GTMS_CLINIC",
        },
      },
    };

    const data = {
      ClinicCreateOrUpdate: {
        ClinicName: "GRAIL Test Clinic",
        Address: "210 Euston Rd, London NW1 2DA",
        Postcode: "SO42 7BZ",
      },
    };

    const result = await processMessage(
      clinicData,
      data,
      environment,
      mockS3Client,
      workflows,
      29012024
    );
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      `Successfully pushed to dev-1-inbound-gtms-clinic-create-or-update/clinic_create_or_update_29012024.json`
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, {
      $metadata: { httpStatusCode: 200 },
    });
  });

  test("successfully identify Appointments, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = "dev-1";
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const appointmentData = {
      initial_response: {
        headers: {
          "mex-workflowid": "GTMS_APPOINTMENT",
        },
      },
    };
    const data = {
      Appointment: {
        ParticipantID: "NHS-AB12-CD34",
        AppointmentID: "00000000-0000-0000-0000-000000000000",
        ClinicID: "D7E-G2H",
        AppointmentDateTime: "2006-01-02T15:04:05.000Z",
        BloodCollectionDate: "2006-01-02",
        PrimaryPhoneNumber: "01999999999",
        SecondaryPhoneNumber: "01999999999",
        Email: "me@example.com",
      },
    };

    const result = await processMessage(
      appointmentData,
      data,
      environment,
      mockS3Client,
      workflows,
      29012024
    );
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      `Successfully pushed to dev-1-inbound-gtms-appointment/appointment_29012024.json`
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, {
      $metadata: { httpStatusCode: 200 },
    });
  });

  test("successfully identify ClinicScheduleSummary, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = "dev-1";
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const clinicCapacityData = {
      initial_response: {
        headers: {
          "mex-workflowid": "GTMS_CLINIC_SCHEDULE",
        },
      },
    };
    const data = {
      ClinicScheduleSummary: {
        test_data: "example",
      },
    };

    const result = await processMessage(
      clinicCapacityData,
      data,
      environment,
      mockS3Client,
      workflows,
      29012024
    );
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      `Successfully pushed to dev-1-inbound-gtms-clinic-schedule-summary/clinic_schedule_summary_29012024.json`
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, {
      $metadata: { httpStatusCode: 200 },
    });
  });

  test("successfully identify Withdrawal, and push to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");

    const environment = "dev-1";
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const withdrawalData = {
      initial_response: {
        headers: {
          "mex-workflowid": "GTMS_WITHDRAW",
        },
      },
    };
    const data = {
      Withdrawal: {
        test_data: "example",
      },
    };

    const result = await processMessage(
      withdrawalData,
      data,
      environment,
      mockS3Client,
      workflows,
      29012024
    );
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      `Successfully pushed to dev-1-inbound-gtms-withdrawal/withdrawal_29012024.json`
    );
    expect(logSpy).toHaveBeenNthCalledWith(2, {
      $metadata: { httpStatusCode: 200 },
    });
  });
});

describe("getHeathStatusCode", () => {
  const mockConfig = {
    url: "example",
    mailboxID: "example",
    mailboxPassword: "example",
    sharedKey: "example",
    agent: "example",
  };
  test("test getHealthStatusCode", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    //pass in mocked handShake function from globally mocked nhs-mesh-client module
    const result = await getHealthStatusCode(mockConfig, handShake);
    console.log(`result: ${result}`);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `result: Handshake successful, status 200`
    );
    expect(result).toBe("Handshake successful, status 200");
  });

  test("test getHealthStatusCode failure", async () => {
    handShake.mockRejectedValue(
      "ERROR: Request 'handShake' completed but responded with incorrect status"
    );
    const logSpy = jest.spyOn(global.console, "log");
    try {
      const result = await getHealthStatusCode(mockConfig, handShake);
      console.log(`result: ${result}`);
    } catch (err) {
      console.log(err);
      expect(err).toBe(
        "ERROR: Request 'handShake' completed but responded with incorrect status"
      );
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(`result: undefined`);
    }
  });
});

describe("getMessageArray", () => {
  const mockConfig = {
    url: "example",
    mailboxID: "example",
    mailboxPassword: "example",
    sharedKey: "example",
    agent: "example",
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("test getMessageArray", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    //pass in mocked getMessageCount function from globally mocked nhs-mesh-client module
    const result = await getMessageArray(mockConfig, getMessageCount);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenNthCalledWith(1, `Inbox contains 1 messages`);
    expect(logSpy).toHaveBeenNthCalledWith(2, `123ID`);
    expect(result).toBe("123ID");
  });

  test("test getMessageArray failure", async () => {
    getMessageCount.mockRejectedValue(
      "ERROR: Request 'getMessageCount' completed but responded with incorrect status"
    );
    const logSpy = jest.spyOn(global.console, "log");
    try {
      const result = await getMessageArray(mockConfig, getMessageCount);
      console.log(`result: ${result}`);
    } catch (err) {
      console.log(err);
      expect(err).toBe(
        "ERROR: Request 'getMessageCount' completed but responded with incorrect status"
      );
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(`result: undefined`);
    }
  });
});

describe("markRead", () => {
  const mockConfig = {
    url: "example",
    mailboxID: "example",
    mailboxPassword: "example",
    sharedKey: "example",
    agent: "example",
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("test markRead", async () => {
    const msgID = "123ID";
    const logSpy = jest.spyOn(global.console, "log");
    //pass in mocked markAsRead function from globally mocked nhs-mesh-client module
    const result = await markRead(mockConfig, markAsRead, msgID);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("message cleared");
    expect(result).toBe("message cleared");
  });

  test("test markRead failure", async () => {
    markAsRead.mockRejectedValue(
      "ERROR: Request 'markAsRead' completed but responded with incorrect status"
    );
    const msgID = "123ID";
    const logSpy = jest.spyOn(global.console, "log");
    try {
      const result = await markRead(mockConfig, markAsRead, msgID);
      console.log(result);
    } catch (err) {
      console.log(err);
      expect(err).toBe(
        "ERROR: Request 'markAsRead' completed but responded with incorrect status"
      );
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(`result: undefined`);
    }
  });
});

describe("readMsg", () => {
  const mockConfig = {
    url: "example",
    mailboxID: "example",
    mailboxPassword: "example",
    sharedKey: "example",
    agent: "example",
    outputFilePath: "example",
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });
  test("test readMsg", async () => {
    const msgID = "123ID";
    const logSpy = jest.spyOn(global.console, "log");
    //pass in mocked readMessage function from globally mocked nhs-mesh-client module
    const result = await readMsg(mockConfig, readMessage, msgID);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({ nhs_num: "123", name: "bolo" });
  });

  test("test readMsg failure", async () => {
    readMessage.mockRejectedValue(
      "ERROR: Request 'readMessage' completed but responded with incorrect status"
    );
    const msgID = "123ID";
    const logSpy = jest.spyOn(global.console, "log");
    try {
      const result = await readMsg(mockConfig, readMessage, msgID);
      console.log(result);
    } catch (err) {
      console.log(err);
      expect(err).toBe(
        "ERROR: Request 'readMessage' completed but responded with incorrect status"
      );
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(`result: undefined`);
    }
  });
});
