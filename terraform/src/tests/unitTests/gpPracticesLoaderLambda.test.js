import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

import * as fs from 'fs';
import path from 'path';

import {
  readCsvFromS3,
  parseCsvToArray,
  saveArrayToTable,
  getItemFromTable
} from '../../gpPracticesLoaderLambda/gpPracticesLoaderLambda.js';

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
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(logErrorMsg);

  });
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

describe("getItemFromTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("return item for key", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const item = {
      "LSOA_2011": {
        "S": "lsoa"
      }
    };
    mockDynamoDbClient.resolves({
      "$metadata": {
          "httpStatusCode": 200
      },
      "Item": item
    });

    const result = await getItemFromTable("postcode", "env", mockDynamoDbClient);
    expect(result).toEqual(item);
  });

  test("Failed response when error occurs getting item for key", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    mockDynamoDbClient.resolves({
      "$metadata": {
          "httpStatusCode": 404
      }
    });

    const postcode = "postcode";
    try {
      await getItemFromTable(postcode, "env", mockDynamoDbClient);
    } catch(err) {
      expect(err.message).toEqual(`Error looking up item: ${postcode}`);
    }
  });
});

describe("saveArrayToTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("save array items to table", async () => {
    const logSpy = jest.spyOn(global.console, 'log');
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const postcodeItem = {
      "LSOA_2011": {
        "S": "lsoa"
      }
    };
    mockDynamoDbClient
      .on(GetItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Item": postcodeItem
      })
      .on(UpdateItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        }
      });

    const arrayItem = {
      'Code': 'gp_practice_code',
      'High Level Health Geography Code': 'icb_id',
      'Name': 'gp_practice_name',
      'Address Line 1': 'address_line_1',
      'Address Line 2': 'address_line_2',
      'Address Line 3': 'address_line_3',
      'Town': 'address_line_4',
      'County': 'address_line_5',
      'Contact Telephone Number': 'telephone_number',
      'Postcode': 'postcode',
      'Legal Start Date': 'open_date',
      'Legal End Date': 'close_date',
    };
    const itemArray = [arrayItem];
    await saveArrayToTable(itemArray, "env", mockDynamoDbClient);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(`Updated item: ${JSON.stringify(arrayItem)}`);
  });

  test("Failed response when error occurs saving array items to table", async () => {
    const logSpy = jest.spyOn(global.console, 'log');
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const postcodeItem = {
      "LSOA_2011": {
        "S": "lsoa"
      }
    };
    mockDynamoDbClient
      .on(GetItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "Item": postcodeItem
      })
      .on(UpdateItemCommand)
      .resolves({
        "$metadata": {
            "httpStatusCode": 400
        }
      });

    const arrayItem = {
      'Code': 'gp_practice_code',
      'High Level Health Geography Code': 'icb_id',
      'Name': 'gp_practice_name',
      'Address Line 1': 'address_line_1',
      'Address Line 2': 'address_line_2',
      'Address Line 3': 'address_line_3',
      'Town': 'address_line_4',
      'County': 'address_line_5',
      'Contact Telephone Number': 'telephone_number',
      'Postcode': 'postcode',
      'Legal Start Date': 'open_date',
      'Legal End Date': 'close_date',
    };
    const itemArray = [arrayItem];
    await saveArrayToTable(itemArray, "env", mockDynamoDbClient);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(`Error inserted item: ${JSON.stringify(arrayItem)}`);
  });
});
