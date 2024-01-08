import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import * as fs from 'fs';
import path from 'path';

import {
  readCsvFromS3,
  parseCsvToArray,
  saveArrayToTable
} from '../../userAccountsLambda/userAccountsLambda.js';

describe("readCsvFromS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("return string built from csv file", async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const stream = sdkStreamMixin(fs.createReadStream(path.resolve(__dirname,'./testData/chunk_1.csv')))

    mockS3Client.resolves({
      Body: stream,
    });

    const result = await readCsvFromS3('aaaaaaa', 'aaaaaaa', mockS3Client)

    const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n'

    expect(result).toEqual(
      expected_result
    )
  });

  test("Failed response when error occurs getting file from bucket", async () => {
    const logSpy = jest.spyOn(global.console, 'log');
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

    const logErrorMsg = `Reading object ${key} from bucket ${bucket}`
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(logErrorMsg);

  });
});

describe("saveArrayToTable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const arrayItem = {
    'UUID': '5555 5000 7000',
    'Name': 'Tom Jones',
    'Email Address': 'a@a.com',
    'Status': 'status',
    'Start Date': '2024-04-01',
    'Role': 'Invitation Planner',
  };

  test("save array items to table", async () => {
    const logSpy = jest.spyOn(global.console, 'log');
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient
      .on(UpdateItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        }
      });

    const itemArray = [arrayItem];
    await saveArrayToTable(itemArray, "env", mockDynamoDbClient);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Populating database table');
  });

  describe('parseCsvToArray', () => {
    const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

    test('should parse CSV string and call processFunction for each row', async () => {

      const result = await parseCsvToArray(testCsvString);

      expect(result).toEqual([
        { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
        { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
      ]);
    });
  });

  test("Failed response when error occurs saving array items to table", async () => {
    const logSpy = jest.spyOn(global.console, 'error');
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient
      .on(UpdateItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 400
        }
      });

    const itemArray = [arrayItem];
    await saveArrayToTable(itemArray, "env", mockDynamoDbClient);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Error updating item: ${JSON.stringify(arrayItem)}`);
  });
});
