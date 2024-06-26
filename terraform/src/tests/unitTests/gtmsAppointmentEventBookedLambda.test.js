import { mockClient } from "aws-sdk-client-mock";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import * as fs from "fs";
import path from "path";

import {
  readCsvFromS3,
  pushCsvToS3,
  lookUp,
  transactionalWrite,
} from "../../gtmsAppointmentEventBookedLambda/gtmsAppointmentEventBookedLambda.js";

describe("readCsvFromS3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Failed response when error occurs getting file from bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorStr = "Error: Mocked error";
    const errorMsg = new Error(errorStr);
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    const bucket = "bucketName";
    const key = "key";
    try {
      await readCsvFromS3(bucket, key, mockClient);
    } catch (err) {
      expect(err.message).toBe("Error: Mocked error");
    }

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      "Error: Failed to read from bucketName/key"
    );
  });

  test("return string built from csv file", async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const stream = sdkStreamMixin(
      fs.createReadStream(path.resolve(__dirname, "./testData/chunk_1.csv"))
    );

    mockS3Client.resolves({
      Body: stream,
    });

    const result = await readCsvFromS3("aaaaaaa", "aaaaaaa", mockS3Client);

    const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n';

    expect(result).toEqual(expected_result);
  });
});

describe("pushCsvToS3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
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
      "galleri-ons-data",
      "test.txt",
      "dfsdfd",
      mockS3Client
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Successfully pushed to galleri-ons-data/test.txt`
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });
  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushCsvToS3("galleri-ons-data", "test.txt", "dfsdfd", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Failed to push to galleri-ons-data/test.txt. Error Message: ${errorMsg}`
    );
  });
});

describe("lookUp", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does not exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result.Items).toEqual(["I exist"]);
  });

  test("should return unsuccessful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result.Items).toEqual([]);
  });
});

describe("transactionalWrite", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("Return successful response if participant exists", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const participantId = "NHS-12345";
    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const eventType = "CANCELLED";
    const episodeEvent = "Appointment Cancelled by Participant - Withdrawn";
    const eventDescription = "example";
    const timestamp = "2024-05-07T10:00:00.999999999Z";
    const clinicId = "12346";
    const appointmentDateTime = "2024-06-02T15:00:00.000Z";
    const channel = "ONLINE";
    const pdsNHSNumber = "9000098399";
    const dateOfBirth = "1947-10-02";
    const cancellationReason = "cancellationReason";
    const bloodNotCollectedReason = "bloodNotCollectedReason";
    const grailId = "12345";
    const primaryNumber = "07777777777";
    const secondaryNumber = "07888888888";
    const email = "me@example.com";
    const bloodCollectionDate = "2024-05-07T10:00:00.999999999Z";
    const appointmentReplaces = "replaces";
    const invitationNHSNumber = "9000098399";
    const appointmentAccessibility = {
      M: {
        accessibleToilet: {
          BOOL: true,
        },
        disabledParking: {
          BOOL: true,
        },
        inductionLoop: {
          BOOL: true,
        },
        signLanguage: {
          BOOL: true,
        },
        stepFreeAccess: {
          BOOL: true,
        },
        wheelchairAccess: {
          BOOL: true,
        },
      },
    };
    const communicationsAccessibility = {
      M: {
        signLanguage: {
          BOOL: true,
        },
        braille: {
          BOOL: false,
        },
        interpreter: {
          BOOL: false,
        },
        language: {
          S: "ARABIC",
        },
      },
    };

    const notificationPreferences = {
      M: {
        canEmail: {
          BOOL: true,
        },
        canSMS: {
          BOOL: false,
        },
      },
    };

    const result = await transactionalWrite(
      mockDynamoDbClient,
      participantId,
      batchId,
      appointmentId,
      eventType,
      episodeEvent,
      eventDescription,
      timestamp,
      clinicId,
      appointmentDateTime,
      channel,
      invitationNHSNumber,
      pdsNHSNumber,
      dateOfBirth,
      cancellationReason, //reason its cancelled coming from payload
      grailId,
      bloodNotCollectedReason,
      primaryNumber,
      secondaryNumber,
      email,
      bloodCollectionDate,
      appointmentReplaces,
      appointmentAccessibility,
      communicationsAccessibility,
      notificationPreferences
    );

    expect(result).toEqual(true);
  });

  test("Return unsuccessful response if participant does not exist", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400,
      },
      Items: [],
    });

    const participantId = "NHS-12345";
    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const eventType = "CANCELLED";
    const episodeEvent = "Appointment Cancelled by Participant - Withdrawn";
    const eventDescription = "example";
    const timestamp = "2024-05-07T10:00:00.999999999Z";
    const clinicId = "12346";
    const appointmentDateTime = "2024-06-02T15:00:00.000Z";
    const channel = "ONLINE";
    const pdsNHSNumber = "9000098399";
    const dateOfBirth = "1947-10-02";
    const cancellationReason = "cancellationReason";
    const bloodNotCollectedReason = "bloodNotCollectedReason";
    const grailId = "12345";
    const primaryNumber = "07777777777";
    const secondaryNumber = "07888888888";
    const email = "me@example.com";
    const bloodCollectionDate = "2024-05-07T10:00:00.999999999Z";
    const appointmentReplaces = "replaces";
    const invitationNHSNumber = "9000098399";
    const appointmentAccessibility = {
      M: {
        accessibleToilet: {
          BOOL: true,
        },
        disabledParking: {
          BOOL: true,
        },
        inductionLoop: {
          BOOL: true,
        },
        signLanguage: {
          BOOL: true,
        },
        stepFreeAccess: {
          BOOL: true,
        },
        wheelchairAccess: {
          BOOL: true,
        },
      },
    };
    const communicationsAccessibility = {
      M: {
        signLanguage: {
          BOOL: true,
        },
        braille: {
          BOOL: false,
        },
        interpreter: {
          BOOL: false,
        },
        language: {
          S: "ARABIC",
        },
      },
    };

    const notificationPreferences = {
      M: {
        canEmail: {
          BOOL: true,
        },
        canSMS: {
          BOOL: false,
        },
      },
    };
    const result = await transactionalWrite(
      mockDynamoDbClient,
      participantId,
      batchId,
      appointmentId,
      eventType,
      episodeEvent,
      eventDescription,
      timestamp,
      clinicId,
      appointmentDateTime,
      channel,
      invitationNHSNumber,
      pdsNHSNumber,
      dateOfBirth,
      cancellationReason, //reason its cancelled coming from payload
      grailId,
      bloodNotCollectedReason,
      primaryNumber,
      secondaryNumber,
      email,
      bloodCollectionDate,
      appointmentReplaces,
      appointmentAccessibility,
      communicationsAccessibility,
      notificationPreferences
    );

    expect(result).toEqual(false);
  });
});
