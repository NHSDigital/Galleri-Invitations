import { mockClient } from "aws-sdk-client-mock";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { pushCsvToS3, getSecret } from "../../gtmsMeshMailboxLambda/helper";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

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
