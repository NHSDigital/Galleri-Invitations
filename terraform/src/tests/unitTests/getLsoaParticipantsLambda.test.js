import { queryEligiblePopulation, getPopulation } from '../../getLsoaParticipantsLambda/getLsoaParticipantsLambda';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

describe('queryEligiblePopulation', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const lsoaCode = "code"
  const tableItems = []

  test('should push items to array on successful response', async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Body: "hello"
    });

    const result = await queryEligiblePopulation(mockDynamoDbClient, lsoaCode, tableItems);

    expect(result).toEqual("Success");
  });

  test('should fail on unsuccessful response', async () => {
    const logSpy = jest.spyOn(global.console, 'log');

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400
      },
      Body: "hello"
    });

    await queryEligiblePopulation(mockDynamoDbClient, lsoaCode, tableItems);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Unsuccess');
  });
});

describe('getPopulation', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const lsoaList = ["code1", "code2"]

  test('should loop through and add property of LSOA with population info', async () => {
    const logSpy = jest.spyOn(global.console, 'log');

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Body: "hello"
    });
    await getPopulation(lsoaList, mockDynamoDbClient);

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(`lsoa being queried number 2. Population object has 1`);

  });
});


