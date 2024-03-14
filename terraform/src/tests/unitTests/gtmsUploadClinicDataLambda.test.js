import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import * as fs from 'fs';
import path from 'path';

import {
  readCsvFromS3,
  putTableRecord,
  checkPhlebotomy,
  createPhlebotomySite,
  saveObjToPhlebotomyTable,
  deleteTableRecord
} from '../../gtmsUploadClinicDataLambda/gtmsUploadClinicDataLambda.js';

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

describe('checkPhlebotomy', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test('should mock call to dynamoDb successfully', async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Body: "hello"
    });

    const result = await checkPhlebotomy('table', mockDynamoDbClient, 'key');

    expect(result.Body).toEqual("hello");
  });
});

describe('deleteTableRecord', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test('should mock call to dynamoDb successfully', async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Body: "hello"
    });

    const result = await deleteTableRecord(mockDynamoDbClient,'table', 'clinicid', 'clinicname');

    expect(result.Body).toEqual("hello");
  });
});

describe('createPhlebotomySite', () => {
  const meshResponsePass = {
    "ClinicCreateOrUpdate":
    {
      "ClinicID": "CF78U818",
      "ODSCode": "1234",
      "ICBCode": "OPM",
      "ClinicName": "Phlebotomy clinic 34",
      "Address": "test address dynamo put",
      "Postcode": "BH17 7DT",
      "Directions": "These will contain directions to the site"
    }
  }
  test('Should compare values to be true', async () => {
    const val = await createPhlebotomySite(meshResponsePass);
    const expectedVal = { "PutRequest": { "Item": { "Address": { "S": "test address dynamo put" }, "ClinicId": { "S": "CF78U818" }, "ClinicName": { "S": "Phlebotomy clinic 34" }, "Directions": { "S": "These will contain directions to the site" }, "ICBCode": { "S": "OPM" }, "ODSCode": { "S": "1234" }, "Postcode": { "S": "BH17 7DT" }, "TargetFillToPercentage": { "N": "50" } } } }
    expect(val).toEqual(expectedVal);
  });
});

describe('saveObjToPhlebotomyTable', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const meshResponsePass = {
    "ClinicCreateOrUpdate":
    {
      "ClinicID": "CF78U818",
      "ODSCode": "1234",
      "ICBCode": "OPM",
    }
  }
  test('successfully push to dynamodb', async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    const environment = "dev-1"
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 200 }
    });
    const result = await saveObjToPhlebotomyTable(meshResponsePass, environment, mockDynamodbClient);
    expect(result).toBe(true)
  });

  test('Failed to push to dynamodb', async () => {
    const mockDynamodbClient = mockClient(new S3Client({}));
    const environment = "dev-1"
    mockDynamodbClient.resolves({
      $metadata: { httpStatusCode: 400 },
    });
    const result = await saveObjToPhlebotomyTable(meshResponsePass, environment, mockDynamodbClient);
    expect(result).toBe(false);
  });
});
