// import { readCsvFromS3 } from './../../lambdaHandler/dataFilterLambda.js';
// import { pushCsvToS3 } from './../../lambdaHandler/dataFilterLambda.js';
// import { parseCsvToArray } from './../../lambdaHandler/dataFilterLambda.js';
// import { processGridallRow } from './../../lambdaHandler/dataFilterLambda.js';
// import { processImdRow } from './../../lambdaHandler/dataFilterLambda.js';
// import { generateCsvString } from './../../lambdaHandler/dataFilterLambda.js';

// const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"
// "AB1  0AA","AB1 0AA","198001","199606",
// "YZ1  0GH","YZ1 0GH","222111","555444"`
// const mockProcessFunction = jest.fn( () => {})

// describe("readCsvFromS3", () => {
//   test("resolves dataArray", () => {

//   });

//   test("reject promise on error", () => {

//   });
// });

// describe("pushCsvToS3", () => {
//   test("resolves dataArray", () => {

//   });

//   test("reject promise on error", () => {

//   });
// });

// describe("parseCsvToArray", (testCsvString, mockProcessFunction) => {
//   test("resolves dataArray", () => {

//   });

//   test("reject promise on error", () => {

//   });
// });

// describe("processGridallRow", () => {
//   test("returns participant count non-zero with correct data", () => {

//   });

//   test("returns participant count is zero with incorrect data", () => {

//   });
// });

// describe("processImdRow", () => {
//   test("IMD element created when passed IMD data", () => {

//   });
// });

// describe("generateCsvString", () => {
//   test("returns correctly formatted string when given header and data", () => {

//   });
// });

import parseCsvToArray from './../../lambdaHandler/dataFilterLambda.js';
const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"
"AB1  0AA","AB1 0AA","198001","199606",
"YZ1  0GH","YZ1 0GH","222111","555444"`

describe('parseCsvToArray', () => {
  test('should parse CSV string and call processFunction for each row', async () => {

    // Mock the processFunction to track the participating_counter
    const processFunctionMock = jest.fn((dataArray, row, participating_counter) => {
      dataArray.push(row);
      participating_counter++;
      return participating_counter;
    });

    const result = await parseCsvToArray(testCsvString, processFunctionMock);

    expect(processFunctionMock).toHaveBeenCalledTimes(2); // Two rows in the CSV

    expect(result).toEqual([
      { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
      { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
    ]);
  });
});

// const dataArray = [];
// let participating_counter = 0;

// expect(processFunctionMock.mock.calls[0][0]).toBe(dataArray); // First call argument should be dataArray
// expect(processFunctionMock.mock.calls[0][1]).toEqual({ Name: 'John', Age: '30' }); // First call argument should be the first row
// expect(processFunctionMock.mock.calls[0][2]).toBe(participating_counter); // First call argument should be the initial participating_counter value

// expect(processFunctionMock.mock.calls[2][0]).toBe(dataArray); // Third call argument should be dataArray
// expect(processFunctionMock.mock.calls[2][1]).toEqual({ Name: 'Bob', Age: '40' }); // Third call argument should be the third row
// expect(processFunctionMock.mock.results[2].value).toBe(2); // The final participating_counter value after processing all rows
