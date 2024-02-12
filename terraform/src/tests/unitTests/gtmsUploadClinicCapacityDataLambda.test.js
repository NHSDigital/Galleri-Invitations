import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import * as fs from 'fs';
import path from 'path';

import {
  readCsvFromS3,
  pushCsvToS3,
  checkPhlebotomy,
} from '../../gtmsUploadClinicCapacityDataLambda/gtmsUploadClinicCapacityDataLambda.js';

describe("readCsvFromS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Failed response when error occurs getting file from bucket", async () => {
    const logSpy = jest.spyOn(global.console, 'error');
    const errorStr = 'Error: Mocked error';
    const errorMsg = new Error(errorStr)
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    const bucket = 'bucketName';
    const key = 'key'
    try {
      await readCsvFromS3(bucket, key, mockClient);
    } catch (err) {
      expect(err.message).toBe('Error: Mocked error');
    }

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("Failed to read from bucketName/key");

  });

  test("return string built from csv file", async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const stream = sdkStreamMixin(fs.createReadStream(path.resolve(__dirname, './testData/chunk_1.csv')))

    mockS3Client.resolves({
      Body: stream,
    });

    const result = await readCsvFromS3('aaaaaaa', 'aaaaaaa', mockS3Client)

    const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n'

    expect(result).toEqual(
      expected_result
    )
  });
});

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

describe('checkPhlebotomy', () => {
  const meshResponseFail = {
    "ClinicScheduleSummary": [
      {
        "ClinicID": "C1C-A1A",
        "Schedule": [
          {
            "WeekCommencingDate": "2023-09-04T00:00:00.000Z",
            "Availability": 5
          }
        ]
      }
    ]
  }

  const meshResponsePass = {
    "ClinicScheduleSummary": [
      {
        "ClinicID": "CF78U818",
        "Schedule": [
          {
            "WeekCommencingDate": "2023-09-04T00:00:00.000Z",
            "Availability": 5
          }
        ]
      }
    ]
  }

  const phlebotomyArr =
    [
      {
        "Address": {
          "S": "test address dynamo put"
        },
        "Availability": {
          "N": "267"
        },
        "Directions": {
          "S": "These will contain directions to the site"
        },
        "ODSCode": {
          "S": "M40666"
        },
        "ClinicId": {
          "S": "CF78U818"
        },
        "InvitesSent": {
          "N": "133"
        },
        "ICBCode": {
          "S": "QVV"
        },
        "LastSelectedRange": {
          "N": "1"
        },
        "TargetFillToPercentage": {
          "N": "50"
        },
        "PostCode": {
          "S": "BH17 7DT"
        },
        "PrevInviteDate": {
          "S": "Saturday 20 January 2024"
        },
        "ClinicName": {
          "S": "Phlebotomy clinic 34"
        },
        "WeekCommencingDate": {
          "M": {
            "19 February 2024": {
              "N": "19"
            },
            "25 March 2024": {
              "N": "54"
            },
            "4 March 2024": {
              "N": "14"
            },
            "18 March 2024": {
              "N": "19"
            },
            "11 March 2024": {
              "N": "71"
            },
            "26 February 2024": {
              "N": "90"
            }
          }
        }
      }
    ]

  test('Should compare values to be true', async () => {
    const val = await checkPhlebotomy(phlebotomyArr, meshResponsePass, 'ClinicScheduleSummary', 'ClinicID');
    expect(val).toEqual([true, "Phlebotomy clinic 34", { "11 March 2024": { "N": "71" }, "18 March 2024": { "N": "19" }, "19 February 2024": { "N": "19" }, "25 March 2024": { "N": "54" }, "26 February 2024": { "N": "90" }, "4 March 2024": { "N": "14" } }]);
  });

  test('Should compare values to be true', async () => {
    const val = await checkPhlebotomy(phlebotomyArr, meshResponseFail, 'ClinicScheduleSummary', 'ClinicID');
    expect(val).toEqual(false);
  });

});
