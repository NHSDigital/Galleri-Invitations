import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import * as fs from "fs";
import path from "path";

import {
  readCsvFromS3,
  pushCsvToS3,
  parseCsvToArray,
  filterUniqueEntries,
  checkDynamoTable,
  lookUp,
  generateParticipantID,
  getItemFromTable,
  formatDynamoDbRecord,
  uploadToDynamoDb,
  batchWriteRecords,
  generateCsvString,
} from "../../caasFeedAddRecordsLambda/caasFeedAddRecordsLambda";

describe("readCsvFromS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("return string built from csv file", async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const stream = sdkStreamMixin(
      fs.createReadStream(path.resolve(__dirname, "./testData/chunk_1.csv"))
    );
    mockS3Client.resolves({
      Body: stream,
    });

    const result = await readCsvFromS3("aaaaaaa", "aaaaaaa", mockS3Client);
    const expected_result = '"PCD2","PCDS","DOINTR","DOTERM"\n';
    expect(result).toEqual(expected_result);
  });

  test("Failed response when error occurs getting file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };

    try {
      await readCsvFromS3("aaaaaaa", "aaaaaaa", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Error: Failed to read from aaaaaaa/aaaaaaa`
    );
  });
});

describe("pushCsvToS3", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successful response from sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));
    mockS3Client.resolves({
      $metadata: { httpStatusCode: 200 },
    });
    const result = await pushCsvToS3(
      "galleri-ons-data",
      "test.txt",
      "dfsdfd",
      mockS3Client
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Successfully pushed to galleri-ons-data/test.txt`
    );
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });
  test("Failed response when error occurs sending file to bucket", async () => {
    const logSpy = jest.spyOn(global.console, "error");
    const errorMsg = new Error("Mocked error");
    const mockClient = {
      send: jest.fn().mockRejectedValue(errorMsg),
    };
    try {
      await pushCsvToS3("galleri-ons-data", "test.txt", "dfsdfd", mockClient);
    } catch (err) {
      expect(err.message).toBe("Mocked error");
    }
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      `Error: Failed to push to galleri-ons-data/test.txt. Error Message: ${errorMsg}`
    );
  });
});

describe("parseCsvToArray", () => {
  const testCsvString = `"nhs_number","dob","dod"\n"000","10/01/1991","11/01/1991"\n"111","01/09/2000","15/11/2023"`;
  test("should parse CSV string and call processFunction for each row", async () => {
    const result = await parseCsvToArray(testCsvString);
    expect(result).toEqual([
      { nhs_number: "000", dob: "10/01/1991", dod: "11/01/1991" },
      { nhs_number: "111", dob: "01/09/2000", dod: "15/11/2023" },
    ]);
  });
});

describe("filterUniqueEntries", () => {
  test("returns an array containing unique records with nhs numbers and another array with duplicate records", async () => {
    const uniqueRecords = [
      {
        message: "Validation successful",
        nhs_number: "5558028009",
        superseded_by_nhs_number: "null",
      },
      {
        message: "Validation successful",
        nhs_number: "5558045337",
        superseded_by_nhs_number: "null",
      },
      {
        message: "Validation successful",
        nhs_number: "5558015160",
        superseded_by_nhs_number: "null",
      },
      {
        message: "Validation successful",
        nhs_number: "5558035153",
        superseded_by_nhs_number: "null",
      },
      {
        message: "Validation successful",
        nhs_number: "5027042566",
        superseded_by_nhs_number: "null",
      },
    ];

    const duplicateRecords = [
      {
        message: "Validation successful",
        nhs_number: "5558014954",
        superseded_by_nhs_number: "null",
        primary_care_provider: "P84064",
        gp_connect: "false",
        name_prefix: "Mr",
        given_name: "Damon",
        other_given_names: "null",
        family_name: "Hill",
        date_of_birth: "1964-10-01",
        gender: "1",
        address_line_1: "School House",
        address_line_2: "Cottisford Road",
        address_line_3: "Bristol",
        address_line_4: "Avon",
        address_line_5: "null",
        postcode: "BS5 6TY",
        reason_for_removal: "null",
        reason_for_removal_effective_from_date: "null",
        date_of_death: "null",
        telephone_number: "null",
        mobile_number: "null",
        email_address: "null",
        preferred_language: "null",
        is_interpreter_required: "null",
        action: "UPDATE",
      },
      {
        message: "Validation successful",
        nhs_number: "5558014954",
        superseded_by_nhs_number: "null",
        primary_care_provider: "P84064",
        gp_connect: "false",
        name_prefix: "Mr",
        given_name: "Damon",
        other_given_names: "null",
        family_name: "Hill",
        date_of_birth: "1964-10-01",
        gender: "1",
        address_line_1: "School House",
        address_line_2: "Cottisford Road",
        address_line_3: "Bristol",
        address_line_4: "Avon",
        address_line_5: "null",
        postcode: "BS5 6TY",
        reason_for_removal: "null",
        reason_for_removal_effective_from_date: "null",
        date_of_death: "null",
        telephone_number: "null",
        mobile_number: "null",
        email_address: "null",
        preferred_language: "null",
        is_interpreter_required: "null",
        action: "UPDATE",
      },
      {
        message: "Validation successful",
        nhs_number: "5558014954",
        superseded_by_nhs_number: "null",
        primary_care_provider: "P84064",
        gp_connect: "false",
        name_prefix: "Mr",
        given_name: "Damon",
        other_given_names: "null",
        family_name: "Hill",
        date_of_birth: "1964-10-01",
        gender: "1",
        address_line_1: "School House",
        address_line_2: "Cottisford Road",
        address_line_3: "Bristol",
        address_line_4: "Avon",
        address_line_5: "null",
        postcode: "BS5 6TY",
        reason_for_removal: "null",
        reason_for_removal_effective_from_date: "null",
        date_of_death: "null",
        telephone_number: "null",
        mobile_number: "null",
        email_address: "null",
        preferred_language: "null",
        is_interpreter_required: "null",
        action: "UPDATE",
      },
      {
        message: "Validation successful",
        nhs_number: "5558014954",
        superseded_by_nhs_number: "null",
        primary_care_provider: "P84064",
        gp_connect: "false",
        name_prefix: "Mr",
        given_name: "Damon",
        other_given_names: "null",
        family_name: "Hill",
        date_of_birth: "1964-10-01",
        gender: "1",
        address_line_1: "School House",
        address_line_2: "Cottisford Road",
        address_line_3: "Bristol",
        address_line_4: "Avon",
        address_line_5: "null",
        postcode: "BS5 6TY",
        reason_for_removal: "null",
        reason_for_removal_effective_from_date: "null",
        date_of_death: "null",
        telephone_number: "null",
        mobile_number: "null",
        email_address: "null",
        preferred_language: "null",
        is_interpreter_required: "null",
        action: "UPDATE",
      },
      {
        message: "Validation successful",
        nhs_number: "5558014954",
        superseded_by_nhs_number: "null",
        primary_care_provider: "P84064",
        gp_connect: "false",
        name_prefix: "Mr",
        given_name: "Damon",
        other_given_names: "null",
        family_name: "Hill",
        date_of_birth: "1964-10-01",
        gender: "1",
        address_line_1: "School House",
        address_line_2: "Cottisford Road",
        address_line_3: "Bristol",
        address_line_4: "Avon",
        address_line_5: "null",
        postcode: "BS5 6TY",
        reason_for_removal: "null",
        reason_for_removal_effective_from_date: "null",
        date_of_death: "null",
        telephone_number: "null",
        mobile_number: "null",
        email_address: "null",
        preferred_language: "null",
        is_interpreter_required: "null",
        action: "UPDATE",
      },
    ];

    const recordsArray = [...uniqueRecords, ...duplicateRecords];

    const result = await filterUniqueEntries(recordsArray);

    expect(result.flat().length).toEqual(10);
    expect(result[0].length).toEqual(6);
    expect(result[1].length).toEqual(4);
  });
});

describe("checkDynamoTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const SUCCESSFULL_REPSONSE = 200;
  const UNSUCCESSFULL_REPSONSE = 400;

  test("should return true if item exists in table", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const mockAttribute = "attribute-A";
    const mockTable = "table-A";
    const mockAttributeName = "attributeName-A";
    const mockAttributeType = "Type-A";

    const result = await checkDynamoTable(
      mockDynamoDbClient,
      mockAttribute,
      mockTable,
      mockAttributeName,
      mockAttributeType
    );

    expect(result).toEqual(true);
  });

  test("should return false if item does not exists in table", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const mockAttribute = "attribute-A";
    const mockTable = "table-A";
    const mockAttributeName = "attributeName-A";
    const mockAttributeType = "Type-A";

    const result = await checkDynamoTable(
      mockDynamoDbClient,
      mockAttribute,
      mockTable,
      mockAttributeName,
      mockAttributeType
    );

    expect(result).toEqual(false);
  });
});

describe("lookUp", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const SUCCESSFULL_REPSONSE = 200;
  const UNSUCCESSFULL_REPSONSE = 400;

  test("should return successful response if item does not exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result).toEqual(UNSUCCESSFULL_REPSONSE);
  });

  test("should return unsuccessful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const id = "ID-A";
    const table = "table-A";
    const attribute = "attribute-A";
    const attributeType = "Type-A";

    const result = await lookUp(
      mockDynamoDbClient,
      id,
      table,
      attribute,
      attributeType
    );

    expect(result).toEqual(SUCCESSFULL_REPSONSE);
  });
});

describe("generateParticipantID", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  const SUCCESSFULL_REPSONSE = 200;
  const UNSUCCESSFULL_REPSONSE = 400;

  test("should return participantId matching regex if item does not exist in table", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const result = await generateParticipantID(mockDynamoDbClient);
    console.log(result);

    const testRegex =
      /NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]/.test(
        result
      );

    expect(testRegex).toEqual(true);
  });
});

describe("getItemFromTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does not exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Item: "Table item",
    });

    const partitionKeyName = "PK-Name";
    const partitionKeyType = "PK-Type";
    const partitionKeyValue = "PK-Value";
    const sortKeyName = "SK-Name";
    const sortKeyType = "SK-Type";
    const sortKeyValue = "SK-Name";

    const result = await getItemFromTable(
      mockDynamoDbClient,
      partitionKeyName,
      partitionKeyType,
      partitionKeyValue,
      sortKeyName,
      sortKeyType,
      sortKeyValue
    );

    expect(result.Item).toEqual("Table item");
  });
});

describe("formatDynamoDbRecord", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  const mockRecord = {
    participant_id: "NHS-QJ63-YT22",
    lsoa_2011: "E00000001",
    message: "Validation successful",
    nhs_number: "null",
    superseded_by_nhs_number: "null",
    primary_care_provider: "Y00291",
    gp_connect: "true",
    name_prefix: "Mr",
    given_name: "David",
    other_given_names: "null",
    family_name: "GIB",
    date_of_birth: "1960-04-01",
    gender: "null",
    address_line_1: "TEST3.1.11",
    address_line_2: "PYNES HILL",
    address_line_3: "RYDON LANE",
    address_line_4: "EXETER",
    address_line_5: "DEVON",
    postcode: "BD10 0LH",
    reason_for_removal: "null",
    reason_for_removal_effective_from_date: "null",
    responsible_icb: "null",
    date_of_death: "null",
    telephone_number: "null",
    mobile_number: "null",
    email_address: "null",
    preferred_language: "fr",
    is_interpreter_required: "1",
    action: "ADD",
  };

  test("should successfully format response with correct data", async () => {
    const expectedResult = {
      PutRequest: {
        Item: {
          PersonId: { S: "NHS-QJ63-YT22" },
          LsoaCode: { S: "E00000001" },
          participantId: { S: "NHS-QJ63-YT22" }, // may need to change
          nhs_number: { N: "0" },
          superseded_by_nhs_number: { N: "0" },
          primary_care_provider: { S: "Y00291" },
          gp_connect: { S: "true" },
          name_prefix: { S: "Mr" },
          given_name: { S: "David" },
          other_given_names: { S: "null" },
          family_name: { S: "GIB" },
          date_of_birth: { S: "1960-04-01" },
          gender: { N: "-1" },
          address_line_1: { S: "TEST3.1.11" },
          address_line_2: { S: "PYNES HILL" },
          address_line_3: { S: "RYDON LANE" },
          address_line_4: { S: "EXETER" },
          address_line_5: { S: "DEVON" },
          postcode: { S: "BD10 0LH" },
          reason_for_removal: { S: "null" },
          reason_for_removal_effective_from_date: { S: "null" },
          responsible_icb: { S: "null" },
          date_of_death: { S: "null" },
          telephone_number: { S: "0" },
          mobile_number: { S: "0" },
          email_address: { S: "null" },
          preferred_language: { S: "fr" },
          is_interpreter_required: { BOOL: Boolean("1") },
          Invited: { S: "false" },
          identified_to_be_invited: { BOOL: false },
          action: { S: "ADD" },
        },
      },
    };

    const result = await formatDynamoDbRecord(mockRecord);
    expect(result).toEqual(expectedResult);
  });
});

describe("uploadToDynamoDb", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should return successful response if item does not exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const mockTable = "table-A";
    const mockBatch = [{ records: 1 }, { record: 2 }];

    const result = await uploadToDynamoDb(
      mockDynamoDbClient,
      mockTable,
      mockBatch
    );

    expect(result).toEqual(200);
  });
});

describe("batchWriteRecords", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("Return response 200 when successfully written to db", async () => {
    const batch = [{ value: "A" }, { value: "B" }];

    const chunkSize = 2;

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const result = await batchWriteRecords(
      batch,
      chunkSize,
      mockDynamoDbClient
    );

    expect(result).toEqual([200]);
  });
  test("Return response 400 when no records to write", async () => {
    const batch = [{ value: "A" }, { value: "B" }];

    const chunkSize = 2;

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400,
      },
    });

    const result = await batchWriteRecords(
      batch,
      chunkSize,
      mockDynamoDbClient
    );

    expect(result).toEqual([400]);
  });

  test("Return empty when no records to write", async () => {
    const batch = [];

    const chunkSize = 2;

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400,
      },
    });

    const result = await batchWriteRecords(
      batch,
      chunkSize,
      mockDynamoDbClient
    );

    expect(result).toEqual([]);
  });
});

describe("generateCsvString", () => {
  test("returns correctly formatted string when given header and data", () => {
    const header = "Alpha,Beta,Gamma";
    const dataArray = [
      {
        a: "First",
        b: "Second",
        c: "Third",
      },
      {
        a: "Uno",
        b: "Dos",
        c: "Tres",
      },
    ];
    const result = generateCsvString(header, dataArray);
    expect(result).toEqual(
      "Alpha,Beta,Gamma\nFirst,Second,Third\nUno,Dos,Tres"
    );
  });
});
