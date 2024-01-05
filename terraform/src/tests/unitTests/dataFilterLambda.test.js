test.todo("Fix this test");

// import { mockClient } from "aws-sdk-client-mock";
// import { S3Client } from "@aws-sdk/client-s3";
// import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
// import * as fs from "fs";
// import path from "path";
// import {
//   readCsvFromS3,
//   pushCsvToS3,
//   processGridallRow,
//   processImdRow,
//   generateCsvString,
//   parseCsvToArray,
//   mergeImdGridallData,
// } from "../../filterDataLambda/dataFilterLambda.js";
// describe("readCsvFromS3", () => {
//   afterEach(() => {
//     jest.clearAllMocks();
//   });
//   test("return string built from csv file", async () => {
//     const mockS3Client = mockClient(new S3Client({}));
//     const stream = sdkStreamMixin(
//       fs.createReadStream(path.resolve(__dirname, "./testData/chunk_1.csv"))
//     );
//     mockS3Client.resolves({
//       Body: stream,
//     });
//     const result = await readCsvFromS3("aaaaaaa", "aaaaaaa", mockS3Client);
//     const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n';
//     expect(result).toEqual(expected_result);
//   });
//   test("Failed response when error occurs getting file to bucket", async () => {
//     const logSpy = jest.spyOn(global.console, "log");
//     const errorMsg = new Error("Mocked error");
//     const mockClient = {
//       send: jest.fn().mockRejectedValue(errorMsg),
//     };
//     try {
//       await readCsvFromS3("aaaaaaa", "aaaaaaa", mockClient);
//     } catch (err) {
//       expect(err.message).toBe("Mocked error");
//     }
//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledTimes(1);
//     expect(logSpy).toHaveBeenCalledWith("Failed: ", errorMsg);
//   });
// });
// describe("pushCsvToS3", () => {
//   afterEach(() => {
//     jest.clearAllMocks();
//   });
//   test("Successful response from sending file to bucket", async () => {
//     const logSpy = jest.spyOn(global.console, "log");
//     const mockS3Client = mockClient(new S3Client({}));
//     mockS3Client.resolves({
//       $metadata: { httpStatusCode: 200 },
//     });
//     const result = await pushCsvToS3(
//       "galleri-ons-data",
//       "test.txt",
//       "dfsdfd",
//       mockS3Client
//     );
//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledTimes(1);
//     expect(logSpy).toHaveBeenCalledWith("Succeeded");
//     expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
//   });
//   test("Failed response when error occurs sending file to bucket", async () => {
//     const logSpy = jest.spyOn(global.console, "log");
//     const errorMsg = new Error("Mocked error");
//     const mockClient = {
//       send: jest.fn().mockRejectedValue(errorMsg),
//     };
//     try {
//       await pushCsvToS3("galleri-ons-data", "test.txt", "dfsdfd", mockClient);
//     } catch (err) {
//       expect(err.message).toBe("Mocked error");
//     }
//     expect(logSpy).toHaveBeenCalled();
//     expect(logSpy).toHaveBeenCalledTimes(1);
//     expect(logSpy).toHaveBeenCalledWith("Failed: ", errorMsg);
//   });
// });
// describe("parseCsvToArray", () => {
//   const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`;
//   test("should parse CSV string and call processFunction for each row", async () => {
//     // Mock the processFunction to track the participating_counter
//     const processFunctionMock = jest.fn(
//       (dataArray, row, participating_counter) => {
//         console.log(row);
//         dataArray.push(row);
//         participating_counter++;
//         return participating_counter;
//       }
//     );
//     const result = await parseCsvToArray(testCsvString, processFunctionMock);
//     expect(processFunctionMock).toHaveBeenCalledTimes(2); // Two rows in the CSV
//     expect(result).toEqual([
//       { PCD2: "AB1  0AA", PCDS: "AB1 0AA", DOINTR: "198001", DOTERM: "199606" },
//       { PCD2: "YZ1  0GH", PCDS: "YZ1 0GH", DOINTR: "222111", DOTERM: "555444" },
//     ]);
//   });
// });
// describe("processGridallRow", () => {
//   test("returns participant count non-zero with correct data", () => {
//     const row = {
//       DOTERM: "",
//       CTRY: "E92000001",
//       PCD2: "abc  123",
//       PCDS: "abc 123",
//       ODSLAUA: "aaa",
//       NHSER: "123",
//       SICB: "bbb",
//       CANREG: "456",
//       OSEAST1M: "ccc",
//       OSNRTH1M: "789",
//       LSOA11: "ddd",
//       MSOA11: "012",
//       CALNCV: "eee",
//       ICB: "QE1",
//       OA21: "fff",
//       LSOA21: "567",
//       MSOA21: "ggg",
//     };
//     let participating_counter = 0;
//     const dataArray = [];
//     const result = processGridallRow(dataArray, row, participating_counter);
//     expect(result).toEqual(1);
//     expect(dataArray).toEqual([
//       {
//         POSTCODE: "abc  123",
//         POSTCODE_2: "abc 123",
//         LOCAL_AUT_ORG: "aaa",
//         NHS_ENG_REGION: "123",
//         SUB_ICB: "bbb",
//         CANCER_REGISTRY: "456",
//         EASTING_1M: "ccc",
//         NORTHING_1M: "789",
//         LSOA_2011: "ddd",
//         MSOA_2011: "012",
//         CANCER_ALLIANCE: "eee",
//         ICB: "QE1",
//         OA_2021: "fff",
//         LSOA_2021: "567",
//         MSOA_2021: "ggg",
//       },
//     ]);
//   });
//   test("returns participant count is zero with incorrect data", () => {
//     const row = {
//       DOTERM: "not empty",
//       CTRY: "000",
//       PCD2: "abc  123",
//       PCDS: "abc 123",
//       ODSLAUA: "aaa",
//       NHSER: "123",
//       SICB: "bbb",
//       CANREG: "456",
//       OSEAST1M: "ccc",
//       OSNRTH1M: "789",
//       LSOA11: "ddd",
//       MSOA11: "012",
//       CALNCV: "eee",
//       ICB: "ZZZ",
//       OA21: "fff",
//       LSOA21: "567",
//       MSOA21: "ggg",
//     };
//     let participating_counter = 0;
//     const dataArray = [];
//     const result = processGridallRow(dataArray, row, participating_counter);
//     expect(result).toEqual(0);
//     expect(dataArray).toEqual([]);
//   });
// });
// describe("processImdRow", () => {
//   const row = {
//     "LSOA code (2011)": "AAAAA",
//     "LSOA name (2011)": "NAME123",
//     "Index of Multiple Deprivation (IMD) Rank": "2,000",
//     "Index of Multiple Deprivation (IMD) Decile": "1",
//   };
//   test("IMD element created when passed IMD data", () => {
//     const dataArray = [];
//     let participating_counter = 0;
//     const result = processImdRow(dataArray, row, participating_counter);
//     expect(dataArray).toEqual([
//       {
//         LSOA_CODE: "AAAAA",
//         LSOA_NAME: "NAME123",
//         IMD_RANK: "2000",
//         IMD_DECILE: "1",
//       },
//     ]);
//   });
// });
// describe("generateCsvString", () => {
//   test("returns correctly formatted string when given header and data", () => {
//     const header = "Alpha,Beta,Gamma";
//     const dataArray = [
//       {
//         a: "First",
//         b: "Second",
//         c: "Third",
//       },
//       {
//         a: "Uno",
//         b: "Dos",
//         c: "Tres",
//       },
//     ];
//     const result = generateCsvString(header, dataArray);
//     expect(result).toEqual(
//       "Alpha,Beta,Gamma\nFirst,Second,Third\nUno,Dos,Tres"
//     );
//   });
// });
// describe("mergeImdGridallData", () => {
//   test("returns an array with elements that are combined", () => {
//     const gridallData = [
//       {
//         LSOA_2011: "alpha",
//         entry: "test1",
//       },
//       {
//         LSOA_2011: "zeta",
//         entry: "test2",
//       },
//     ];
//     const imdData = [
//       {
//         IMD_RANK: "23",
//         IMD_DECILE: "1",
//         LSOA_CODE: "alpha",
//         throwaway: "should not be in lsoaArray",
//       },
//       {
//         IMD_RANK: "77",
//         IMD_DECILE: "8",
//         LSOA_CODE: "zeta",
//         throwaway: "should not be in lsoaArray again",
//       },
//     ];
//     const startTime = 0;
//     const result = mergeImdGridallData(gridallData, imdData, startTime);
//     const expected_result = [
//       {
//         LSOA_2011: "alpha",
//         entry: "test1",
//         IMD_RANK: "23",
//         IMD_DECILE: "1",
//       },
//       {
//         LSOA_2011: "zeta",
//         entry: "test2",
//         IMD_RANK: "77",
//         IMD_DECILE: "8",
//       },
//     ];
//     expect(result).toEqual(expected_result);
//   });
// });
