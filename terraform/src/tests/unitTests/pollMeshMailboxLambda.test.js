import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { pushCsvToS3, getSecret, chunking, multipleUpload } from "../../pollMeshMailboxLambda/helper"; //chunking, getSecret, multipleUpload
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

describe("chunking", () => {

  test("create chunks", async () => {
    let message = 'nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
      '5558028009,null,B83006\n' +
      '5558045337,null,D81026';
    const header = message.split("\n")[0];
    const messageBody = message.split("\n").splice(1);
    const x = new Set(messageBody);
    let chunk = [...chunking(x, 2, header)];

    expect(chunk[0]).toBe('nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
      '5558028009,null,B83006');
    expect(chunk[1]).toBe('nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
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
    const smClient = mockClient(SecretsManagerClient);


    smClient.on(GetSecretValueCommand).resolves({
      SecretString: JSON.stringify({ my_secret_key: 'my_secret_value' }),
    });
    const sm = new SecretsManagerClient({});
    const result = await sm.send(new GetSecretValueCommand({ "SecretId": "MESH_SENDER_CERT" }));
    expect(result.SecretString).toBe('{"my_secret_key":"my_secret_value"}');

    const smClient2 = mockClient(SecretsManagerClient);
    smClient2.resolves({});
    const response = await getSecret("MESH_SENDER_CERT", smClient2);
    // console.log(response);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`Retrieved value successfully MESH_SENDER_CERT`);

  })
})

describe("multipleUpload", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Successfully upload data to S3", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const mockS3Client = mockClient(new S3Client({}));

    const chunk = ['nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
      '5558028009,null,B83006',
    'nhs_number,superseded_by_nhs_number,primary_care_provider\n' +
    '5558045337,null,D81026'];
    const ENVIRONMENT = 'dev-1';

    mockS3Client.on(PutObjectCommand).resolves({
      $metadata: { httpStatusCode: 200 },
    });

    const result = await multipleUpload(chunk, mockS3Client, ENVIRONMENT);
    console.log(result);
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenCalledWith([{ "$metadata": { "httpStatusCode": 200 } }, { "$metadata": { "httpStatusCode": 200 } }]);
    expect(result[0]).toHaveProperty("$metadata.httpStatusCode", 200);
  })
})

//TODO: tests for run, runMessage, sendMessage, markRead, ReadMsg
