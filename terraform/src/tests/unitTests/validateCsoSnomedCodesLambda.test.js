import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import AWS from "aws-sdk-mock";
import {
  readFromS3,
  pushToS3,
} from "../../validateCsoSnomedCodesLambda/validateCsoSnomedCodesLambda";

describe("S3 Operations", () => {
  test("Successful response from sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await pushToS3(
      "processed-appointments",
      "test.txt",
      "dfsdfd",
      mockS3Client
    );
    expect(logSpy).toHaveBeenCalledTimes(0);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });

  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushToS3(
        "processed-appointments",
        "test.txt",
        "dfsdfd",
        mockClient
      );
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Error: ", errorMsg);
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
