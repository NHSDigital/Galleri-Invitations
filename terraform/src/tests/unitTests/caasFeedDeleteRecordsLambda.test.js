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
  getParticipantId,
  hasAppointment,
  generateCsvString,
  updatePopulationTable,
  updateAppointmentTable,
} from "../../caasFeedDeleteRecordsLambda/caasFeedDeleteRecordsLambda";

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
    const logSpy = jest.spyOn(global.console, "log");
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
    expect(logSpy).toHaveBeenCalledWith(`Failed to read from aaaaaaa/aaaaaaa`);
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
    const logSpy = jest.spyOn(global.console, "log");
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
      `Failed to push to galleri-ons-data/test.txt. Error Message: ${errorMsg}`
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

    expect(result.flat().length).toEqual(6);
  });
});

describe("getParticipantId", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should successfully get participant ID from valid NHS number", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const nhsNumber = "898923432";
    const table = "table-A";

    const result = await getParticipantId(mockDynamoDbClient, nhsNumber, table);

    expect(result.Items).toEqual(["I exist"]);
  });

  test("should return unsuccessful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const nhsNumber = "898923432";
    const table = "table-A";

    const result = await getParticipantId(mockDynamoDbClient, nhsNumber, table);

    expect(result.Items).toEqual([]);
  });
});

describe("hasAppointment", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should successfully check if participant has an appointment from participant ID", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["I exist"],
    });

    const participantId = "NHS-8989-2343";
    const table = "table-A";

    const result = await hasAppointment(
      mockDynamoDbClient,
      participantId,
      table
    );

    expect(result.Items).toEqual(["I exist"]);
  });

  test("should return unsuccessful response if item does exist from query", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const participantId = "NHS-8989-2343";
    const table = "table-A";

    const result = await hasAppointment(
      mockDynamoDbClient,
      participantId,
      table
    );

    expect(result.Items).toEqual([]);
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

describe("updatePopulationTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  test("returns 200 when call executes successfully", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const table = "table-A";
    const participantId = "NHS-3273-2782";

    const result = await updatePopulationTable(
      mockDynamoDbClient,
      participantId,
      table
    );
    expect(result).toEqual(200);
  });
});

describe("updateAppointmentTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  test("returns 200 when call executes successfully", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const table = "table-A";
    const participantId = "NHS-3273-2782";

    const result = await updateAppointmentTable(
      mockDynamoDbClient,
      participantId,
      table
    );
    expect(result).toEqual(200);
  });
});
