import { getClinicEastingNorthing, scanLsoaTable, populateLsoaArray, calculateDistance, generateLsoaTableData } from '../../getLsoaInRange/lambdaHandler/getLsoaInRangeLambda.js';
import * as axios from "axios";

jest.mock("axios");

describe('getClinicEastingNorthing', () => {
  const mockPostcode = "Post code"

  test('should successfully return eastings and northing from axios request', async () => {
    const logSpy = jest.spyOn(global.console, 'log');
    // mock out the axios call to return an object
    const mockResponse = {
      data:
      {
        status: 200,
        result: {
          eastings: 100,
          northings: 150
        }
      }
    }
    axios.get.mockResolvedValueOnce(mockResponse);
    // axios.get = jest.fn().mockResolvedValueOnce(mockResponse)
    // console.log(axios.get.mockResolvedValueOnce)
    // axios.get.mockImplementation(() => Promise.resolve(mockResponse));

    const result = await getClinicEastingNorthing(mockPostcode);

    console.log(result)

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      easting: 100,
      northing: 150
    });
  });

  test('should catch error if API request fails', async () => {
    // mock out the axios call to return an object
    const mockResponse = {
      data:
        {}
    }
    axios.get.mockResolvedValueOnce(mockResponse);

    expect(() => {
      getClinicEastingNorthing();
    }).toThrow("Error when trying to retrieve postcode grid reference");

  });

  test('should throw error if request fails', async () => {
    // mock out the axios call to return an object
    const mockResponse = {
      data:
        {}
    }
    axios.get.mockResolvedValueOnce(mockResponse);

    expect(() => {
      getClinicEastingNorthing();
    }).toThrow("Grid coordinates not returned by api");

  });
});

// describe('scanLsoaTable', () => {
//   const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

//   test('should parse CSV string and call processFunction for each row', async () => {

//     const result = await scanLsoaTable(testCsvString);

//     expect(result).toEqual([
//       { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
//       { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
//     ]);
//   });
// });

// describe('populateLsoaArray', () => {
//   const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

//   test('should parse CSV string and call processFunction for each row', async () => {

//     const result = await populateLsoaArray(testCsvString);

//     expect(result).toEqual([
//       { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
//       { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
//     ]);
//   });
// });

// describe('calculateDistance', () => {
//   const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

//   test('should parse CSV string and call processFunction for each row', async () => {

//     const result = await calculateDistance(testCsvString);

//     expect(result).toEqual([
//       { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
//       { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
//     ]);
//   });
// });

// describe('generateLsoaTableData', () => {
//   const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`

//   test('should parse CSV string and call processFunction for each row', async () => {

//     const result = await generateLsoaTableData(testCsvString);

//     expect(result).toEqual([
//       { PCD2: 'AB1  0AA', PCDS: 'AB1 0AA', DOINTR: '198001', DOTERM: '199606' },
//       { PCD2: 'YZ1  0GH', PCDS: 'YZ1 0GH', DOINTR: '222111', DOTERM: '555444' }
//     ]);
//   });
// });
