import { getClinicEastingNorthing, scanLsoaTable, populateLsoaArray, calculateDistance, generateLsoaTableData } from '../../getLsoaInRange/lambdaHandler/getLsoaInRangeLambda.js';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

describe('getClinicEastingNorthing', () => {

  test('should successfully return eastings and northing from axios request', async () => {
    const mockPostcodeSuccess = "SW1A 2AA"
    const logSpy = jest.spyOn(global.console, 'log');
    // mock out the axios call to return an object

    const result = await getClinicEastingNorthing(mockPostcodeSuccess);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith("Success");

    expect(result).toEqual({
      easting: 530047,
      northing: 179951
    });
  });

  test('should catch error if API request fails', async () => {
    // mock out the axios call to return an object
    const mockPostcodeFail = "AAAA BB"
    const logSpy = jest.spyOn(global.console, 'log');
    // mock out the axios call to return an object

    const result = await getClinicEastingNorthing(mockPostcodeFail);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Unsuccess");

  });

});

describe('scanLsoaTable', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test('should error is http code is not success', async () => {
    const logSpy = jest.spyOn(global.console, 'log');

    mockDynamoDbClient.resolves({
      LastEvaluatedKey: "Present",
      $metadata: { httpStatusCode: 400 },
      Body: "failed"
    });

    const lastEvaluatedItem = {}
    const tableItems = []

    await scanLsoaTable(mockDynamoDbClient, lastEvaluatedItem, tableItems);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Unsuccess");

  });

  test('should run last execution on last iteration', async () => {
    const logSpy = jest.spyOn(global.console, 'log');

    mockDynamoDbClient.resolves({
      $metadata: { httpStatusCode: 200 },
      Body: "exit function"
    });

    const lastEvaluatedItem = {}
    const tableItems = []

    await scanLsoaTable(mockDynamoDbClient, lastEvaluatedItem, tableItems);
    expect(logSpy).toHaveBeenCalledWith("at last bit");

  });

  test('should run last execution on last iteration', async () => {
    const logSpy = jest.spyOn(global.console, 'log');

    mockDynamoDbClient.resolves({
      $metadata: { httpStatusCode: 200 },
      Body: "exit function"
    });

    const lastEvaluatedItem = {}
    const tableItems = []

    const response = await scanLsoaTable(mockDynamoDbClient, lastEvaluatedItem, tableItems);
    expect(response).toEqual("UniqueLsoa table scanned. Returning 1 records");

  });
});


describe('calculateDistance', () => {

  test('should correctly return straight line distance between coordinates', async () => {

    const lsao =  {
      AVG_EASTING: {"S": "10000"},
      AVG_NORTHING: {"S": "15000"}
    }

    const clinicGridReference =  {
      easting: "7000",
      northing: "11000"
    }
    const result = calculateDistance(lsao, clinicGridReference);

    expect(result).toEqual(3.125);
  });
});

describe('generateLsoaTableData', () => {

  test('should format data to be used in table', async () => {

    const lsoaData = [
      {LSOA_2011: {"S": "E100"}},
      {LSOA_2011: {"S": "E200"}}
    ]

    const popData = {
      "E100": 1,
      "E200": 2
    }

    const result = generateLsoaTableData(lsoaData, popData);

    expect(result).toEqual( [ { LSOA_2011: { S: 'E100' } }, { LSOA_2011: { S: 'E200' } } ]);
  });
});
