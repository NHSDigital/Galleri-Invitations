import { mockClient } from "aws-sdk-client-mock";
import { pushCsvToS3, chunking } from "./pollMeshMailboxLambda";

describe("chunking", () => {

  test("create chunks", async () => {
    let message = 'nhs_number,superseded_by_nhs_number,primary_care_provider,\n' +
      '5558028009,null,B83006\n' +
      '5558045337,null,D81026';
    const header = message.split("\n")[0];
    const messageBody = message.split("\n").splice(1);
    const x = new Set(messageBody);
    let chunk = [...chunking(x, 2, header)];

    expect(chunk).toBe('nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
      '5558028009,null,B83006',
      'nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
      '5558045337,null,D81026');
  });
})

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
      "galleri-caas-data",
      "test.csv",
      "arr",
      mockS3Client
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Successfully pushed to galleri-caas-data/test.csv`);
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  });
})

describe("getSecret", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successfully retrieve secret from secret manager", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const smClient = mockClient(new SecretsManagerClient({ region: "eu-west-2" }));

    smClient.resolves({
      $metadata: { httpStatusCode: 200 },
      body: { value: "test" }
    });

    const result = await getSecret("MESH_SECRET_TEST");
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Retrieved value successfully`);
    expect(result).toHaveProperty("body.value", "test");
    expect(result).toHaveProperty("$metadata.httpStatusCode", 200);
  })
})

//Need tests for getSecret, run, runMessage, sendMessage, markRead, ReadMsg, Chunking, pushcsvtos3, multipleUpload
