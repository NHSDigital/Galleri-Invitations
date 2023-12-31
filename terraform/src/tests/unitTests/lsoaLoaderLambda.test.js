import { parseCsvToArray } from "../../lsoaLoaderLambda/lsoaLoaderLambda.js";

describe("parseCsvToArray", () => {
  const testCsvString = `"PCD2","PCDS","DOINTR","DOTERM"\n"AB1  0AA","AB1 0AA","198001","199606"\n"YZ1  0GH","YZ1 0GH","222111","555444"`;

  test("should parse CSV string and call processFunction for each row", async () => {
    const result = await parseCsvToArray(testCsvString);

    expect(result).toEqual([
      { PCD2: "AB1  0AA", PCDS: "AB1 0AA", DOINTR: "198001", DOTERM: "199606" },
      { PCD2: "YZ1  0GH", PCDS: "YZ1 0GH", DOINTR: "222111", DOTERM: "555444" },
    ]);
  });
});
