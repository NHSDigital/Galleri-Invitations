import { mockClient } from "aws-sdk-client-mock";
import AWS from "aws-sdk-mock";
import { S3Client } from "@aws-sdk/client-s3";
import {
  pushS3,
  readS3,
  validateFields,
} from "../../validateGtmsAppointmentLambda/validateGtmsAppointmentLambda.js";

describe("S3 Operations", () => {
  test("Failed response when error occurs getting file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    try {
      await readS3("adwdwad", "dwadsdas", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed to read S3: ", errorMsg);
  });

  test("Successful response from sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await pushS3(
      "gtms-appointment-data",
      "test.txt",
      "dfsdfd",
      mockS3Client
    );
    expect(logSpy).toHaveBeenCalledTimes(0);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });

  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushS3("gtms-appointment-data", "test.txt", "dfsdfd", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed to push to S3: ", errorMsg);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    AWS.mock("S3", "getObject", (params, callback) => {
      // Provide a mocked response for getObject
      callback(null, { Body: "mocked CSV data" });
    });

    AWS.mock("S3", "putObject", (params, callback) => {
      // Provide a mocked response for putObject
      callback(null, "mocked response");
    });
  });

  afterEach(() => {
    AWS.restore("S3");
  });
});

describe("validateFields", () => {
  test("should return validate success for CANCELLED EventType when replaces field is null",
  async () => {
    const appointmentObj = {
      Appointment: {
        EventType: "CANCELLED",
        Replaces: null,
      }
    }
    const expected = {
      valid: true,
    };
    const result = validateFields(appointmentObj);
    expect(result).toEqual(expected);
  });

  test("should return validate failed for CANCELLED EventType when replaces field is not null",
  async () => {
    const appointmentObj = {
      Appointment: {
        EventType: "CANCELLED",
        Replaces: "00000000-ABCD-0000-G&-000000000000",
      }
    }
    const expected = {
      valid: false,
      message: "Replaces field not null when EventType is not BOOKED"
    };
    const result = validateFields(appointmentObj);
    expect(result).toEqual(expected);
  });

  test("should return validate success for BOOKED EventType when replaces field is not null",
  async () => {
    const appointmentObj = {
      Appointment: {
        EventType: "BOOKED",
        Replaces: "00000000-ABCD-0000-G&-000000000000",
      }
    }
    const expected = {
      valid: true,
    };
    const result = validateFields(appointmentObj);
    expect(result).toEqual(expected);
  });
});
