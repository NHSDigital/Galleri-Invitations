import { getItemsFromTable, invokeParticipantListLambda, getParticipantsInQuintile, generateQuintileBlocks } from '../../calculateNumberToInviteLambda/calculateNumberToInviteLambda'
import { mockClient } from 'aws-sdk-client-mock';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

describe('getItemsFromTable', () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test('should push items to array on successful response', async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Body: "hello"
    });

    const result = await getItemsFromTable('table', mockDynamoDbClient, 'key');

    expect(result.Body).toEqual("hello");
  });
});

describe('invokeParticipantListLambda', () => {
  const mockLambdaClient = mockClient(new LambdaClient({}));

  test('should loop through and add property of LSOA with population info', async () => {
    const payload = JSON.stringify({"message": "hello from payload"})

    mockLambdaClient.resolves({
      $metadata: {
        httpStatusCode: 200
      },
      Payload: Buffer.from(payload)
    });

    const result = await invokeParticipantListLambda('lambdaName', payload, mockLambdaClient);

    expect(result).toEqual({
      "message": "hello from payload"
    });

  });
});

describe('getParticipantsInQuintile', () => {

  test('should loop through and add property of LSOA with population info', async () => {
    const forecastUptakeObj = {
      forecastUptake: 100
    }

    const randomStringKey = [...Array(10)].map(() => {
      const randomStr = "abcdefghij".split('').sort(() => .5-Math.random()).join('');
      return [randomStr.slice(0, Math.random()*10 + 2)]
    })
    const quintilePopulationArray = randomStringKey.map(el => {
      let obj = {}
      obj["person"] = el[0]
      obj["forecastUptake"] = 100
      return obj;
    })
    const quintileTarget = 5
    const nationalForecastUptake = 0
    const Q = "test"
    const result =  getParticipantsInQuintile(quintilePopulationArray, quintileTarget, nationalForecastUptake, Q);

    expect(result.length).toEqual(5);

  });
});

describe('generateQuintileBlocks', () => {

  test('should loop through and add property of LSOA with population info', async () => {
    const forecastUptakeObj = {
      forecastUptake: 100
    }

    const randomStringKey = [...Array(10)].map(() => {
      const randomStr = "abcdefghij".split('').sort(() => .5-Math.random()).join('');
      return [randomStr.slice(0, Math.random()*10 + 2)]
    })
    const quintilePopulationArray = randomStringKey.map(el => {
      let obj = {}
      obj["person"] = el[0]
      obj["imdDecile"] = Math.floor(Math.random() * 10)
      return obj;
    })

    const lowerBound = 0
    const upperBound = 5
    const quintile = "test"
    const result =  generateQuintileBlocks(quintilePopulationArray, lowerBound, upperBound, quintile);

    expect(result.length).toEqual(5);
    expect(result[0].imdDecile <= result[1].imdDecile).toEqual(true);
    expect(result[1].imdDecile <= result[2].imdDecile).toEqual(true);
    expect(result[2].imdDecile <= result[3].imdDecile).toEqual(true);
    expect(result[3].imdDecile <= result[4].imdDecile).toEqual(true);

  });
});

