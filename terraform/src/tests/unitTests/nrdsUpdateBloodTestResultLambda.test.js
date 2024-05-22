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
  checkProperties,
  getTagFromS3,
} from "../../nrdsUpdateBloodTestResultLambda/nrdsUpdateBloodTestResultLambda.js";

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

    let testObj = {
      episode_event: "null",
      Grail_FHIR_Result_Id: "MCED-AmendedTest-Example",
      Meta_Last_Updated: "2000-09-11T11:22:00+00:00",
      Identifier_Value: "example",
      Grail_Id: "NHS1234567",
      CSD_Result_SNOWMED_Code: "12345",
      CSD_Result_SNOWMED_Display: "onceICaughtAFishAlive",
      Blood_Draw_Date: "2000-09-11T11:22:00+00:00",
      Cso_Result_Snowmed_Code_Primary: ["6"],
      Cso_Result_Snowmed_Display_Primary: ["7"],
      Cso_Result_Snowmed_Code_Secondary: ["8", "9", "10"],
      Cso_Result_Snowmed_Display_Secondary: ["thenILetItGoAgain"],
      Participant_Id: "NHS-12345",
    };

    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const episodeStatus = "status";

    const result = await transactionalWrite(
      mockDynamoDbClient,
      testObj.participantId,
      batchId,
      appointmentId,
      testObj,
      episodeStatus
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

    let testObj = {
      episode_event: "null",
      Grail_FHIR_Result_Id: "MCED-AmendedTest-Example",
      Meta_Last_Updated: "2000-09-11T11:22:00+00:00",
      Identifier_Value: "example",
      Grail_Id: "NHS1234567",
      CSD_Result_SNOWMED_Code: "Erin",
      CSD_Result_SNOWMED_Display: "Yeager",
      Blood_Draw_Date: "2000-09-11T11:22:00+00:00",
      Cso_Result_Snowmed_Code_Primary: ["Grisha"],
      Cso_Result_Snowmed_Display_Primary: ["Yeager"],
      Cso_Result_Snowmed_Code_Secondary: ["Zeke"],
      Cso_Result_Snowmed_Display_Secondary: ["Yeager"],
      Participant_Id: "NHS-12345",
    };

    const batchId = "IB-pck28f-datsf28f-a233-bug41-2right111f4a53";
    const appointmentId = "12345";
    const episodeStatus = "status";

    const result = await transactionalWrite(
      mockDynamoDbClient,
      testObj.participantId,
      batchId,
      appointmentId,
      testObj,
      episodeStatus
    );

    expect(result).toEqual(false);
  });
});

describe("checkProperties", () => {
  let testObj = {
    t: "Tanjiro",
    a: "Akaza",
    s: "Senku Ishigami",
    k: "",
    ss: [],
  };
  test("reformat object successfully", async () => {
    await checkProperties(testObj);
    console.log(testObj);
    expect(testObj).toEqual({
      t: "Tanjiro",
      a: "Akaza",
      s: "Senku Ishigami",
      k: "null",
      ss: ["null"],
    });
  });
});

describe("getTagFromS3", () => {
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
      await getTagFromS3(bucket, key, mockClient);
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

    mockS3Client.resolves({
      TagSet: [
        { Key: "Levi", Value: "Ackerman" },
        { Key: "Mikasa", Value: "Ackerman" },
      ],
    });

    const result = await getTagFromS3("aaaaaaa", "aaaaaaa", mockS3Client);

    const expected_result = [
      { Key: "Levi", Value: "Ackerman" },
      { Key: "Mikasa", Value: "Ackerman" },
    ];

    expect(result).toEqual(expected_result);
  });
});
