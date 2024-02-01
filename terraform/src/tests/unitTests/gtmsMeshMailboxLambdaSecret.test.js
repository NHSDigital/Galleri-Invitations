import { readSecret } from "../../gtmsMeshMailboxLambda/gtmsMeshMailboxLambda";
import { getSecret } from "../../gtmsMeshMailboxLambda/helper";
// import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
// import { handShake, getMessageCount, markAsRead, readMessage } from "nhs-mesh-client";

jest.mock("../../gtmsMeshMailboxLambda/helper");
getSecret.mockResolvedValue("eyBTZWNyZXRTdHJpbmc6ICIxMjMiIH0=");


describe("readSecret", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })
  afterEach(() => {
    jest.resetAllMocks();
  })
  test('test readSecret', async () => {

    const result = await readSecret("test", "je");
    console.log(result);
    expect(result).toBe('{ SecretString: "123" }');
  })
})
