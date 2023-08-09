import readCsvFromS3 from '../../filterData/lambdaHandler/dataFilterLambda.js';
import pushCsvToS3 from '../../filterData/lambdaHandler/dataFilterLambda.js';
import processGridallRow from '../../filterData/lambdaHandler/dataFilterLambda.js';
import processImdRow from '../../filterData/lambdaHandler/dataFilterLambda.js';
import generateCsvString from '../../filterData/lambdaHandler/dataFilterLambda.js';

import parseCsvToArray from '../../filterData/lambdaHandler/dataFilterLambda.js';

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

describe('parseCsvToArray', () => {
  const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

  test('should parse CSV string and call processFunction for each row', async () => {

    // Mock the processFunction to track the participating_counter
    const processFunctionMock = jest.fn((dataArray, row, participating_counter) => {
      console.log(row)
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

describe("processGridallRow", () => {
  const row = {
    "DOTERM" : "",
    "CTRY" : "E92000001",
    "PCD2": "abc  123",
    "PCDS": "abc 123",
    "ODSLAUA": "aaa",
    "NHSER": "123",
    "SICB": "bbb",
    "CANREG": "456",
    "OSEAST1M": "ccc",
    "OSNRTH1M": "789",
    "LSOA11": "ddd",
    "MSOA11": "012",
    "CALNCV": "eee",
    "ICB": "QE1",
    "OA21": "fff",
    "LSOA21": "567",
    "MSOA21": "ggg",

  }
  let participating_counter = 0
  test("returns participant count non-zero with correct data", () => {
    const dataArray = []
    const result = processGridallRow(dataArray, row, participating_counter);

    expect(result).toEqual(1);

    expect(dataArray).toEqual([
      {
        "POSTCODE" : "abc  123",
        "POSTCODE_2" : "abc 123",
        "LOCAL_AUT_ORG" : "aaa",
        "NHS_ENG_REGION" : "123",
        "SUB_ICB" : "bbb",
        "CANCER_REGISTRY" : "456",
        "EASTING_1M" : "ccc",
        "NORTHING_1M" : "789",
        "LSOA_2011" : "ddd",
        "MSOA_2011": "012",
        "CANCER_ALLIANCE" : "eee",
        "ICB" : "QE1",
        "OA_2021" : "fff",
        "LSOA_2021" : "567",
        "MSOA_2021" : "ggg"
      }
    ]);

  });

  // test("returns participant count is zero with incorrect data", () => {

  // });
});

describe("processImdRow", () => {
  const row = {
    "LSOA code (2011)" : "AAAAA",
    "LSOA name (2011)" : "NAME123",
    "Index of Multiple Deprivation (IMD) Rank" : "2,000",
    "Index of Multiple Deprivation (IMD) Decile" : "1",
  }
  test("IMD element created when passed IMD data", () => {
    const dataArray = []
    let participating_counter = 0
    const result = processImdRow(dataArray, row, participating_counter);

    expect(participating_counter).toEqual(1);

    expect(dataArray).toEqual([
      {
        "LSOA_CODE" : "AAAAA",
        "LSOA_NAME" : "NAME123",
        "IMD_RANK" : "2000",
        "IMD_DECILE" : "1",
      }
    ]);

  });
});

describe("generateCsvString", () => {
  test("returns correctly formatted string when given header and data", () => {
    const header = "Alpha,Beta,Gamma"
    const dataArray = [
      {
        "a" : "First",
        "b" : "Second",
        "c" : "Third"
      },
      {
        "a" : "Uno",
        "b" : "Dos",
        "c" : "Tres"
      }
    ]
    const result = generateCsvString(header, dataArray);

    expect(result).toEqual(
      "Alpha,Beta,Gamma\nFirst,Second,Third\nUno,Dos,Tres"
    )
  });
});




