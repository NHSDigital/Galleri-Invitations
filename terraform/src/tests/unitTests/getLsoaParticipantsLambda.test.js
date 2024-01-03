test.todo("Fix this test");

// import { queryEligiblePopulation, getPopulation } from '../../getLsoaParticipantsLambda/getLsoaParticipantsLambda';
// import { mockClient } from 'aws-sdk-client-mock';
// import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
// import { getEligiblePopulation } from '../../getLsoaParticipantsLambda/getLsoaParticipantsLambda.js';

// describe('queryEligiblePopulation', () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
//   const lsoaCode = "code"
//   const tableItems = []

//   test('should push items to array on successful response', async () => {
//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200
//       },
//       Body: "hello"
//     });

//     const result = await queryEligiblePopulation(mockDynamoDbClient, lsoaCode, tableItems);

//     expect(result).toEqual("Success");
//   });

//   test('should fail on unsuccessful response', async () => {
//     const logSpy = jest.spyOn(global.console, 'log');

//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 400
//       },
//       Body: "hello"
//     });

//     await queryEligiblePopulation(mockDynamoDbClient, lsoaCode, tableItems);

//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledTimes(1);
//     expect(logSpy).toHaveBeenCalledWith('Unsuccess');
//   });
// });

// describe('getPopulation', () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
//   const lsoaList = ["code1", "code2"]

//   test('should loop through and add property of LSOA with population info', async () => {
//     const logSpy = jest.spyOn(global.console, 'log');

//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200
//       },
//       Body: "hello"
//     });
//     await getPopulation(lsoaList, mockDynamoDbClient);

//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledWith(`lsoa being queried number 2. Population object has 0`);

//   });
// });

// describe('getEligiblePopulation', () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
//   const lsoaObj = {
//     "E01000005": { "IMD_DECILE": "3", "FORECAST_UPTAKE": "23" }
//   };

//   test('If eligible return pushed popArr', async () => {
//     const logSpy = jest.spyOn(global.console, 'log');

//     mockDynamoDbClient.resolves({
//       $metadata: { httpStatusCode: 200 },
//       body: [{ personId: '9000149009', imdDecile: '5', forecastUptake: '25' },
//       { personId: '9000221463', imdDecile: '5', forecastUptake: '25' }]
//     });
//     await getEligiblePopulation(lsoaObj, mockDynamoDbClient);

//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledWith(`lsoa being queried number 1. Population object has 0`);
//   });
// });
