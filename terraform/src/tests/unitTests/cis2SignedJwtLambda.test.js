import {
  handler,
  getSecret,
  generateJWT,
  createResponse,
} from "../../cis2SignedJwtLambda/cis2SignedJwtLambda"; // Replace 'your-file-name.js' with the actual file name
import { mockClient } from "aws-sdk-client-mock";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

// Mocking the SecretsManagerClient module
jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn(() => ({
      SecretString: "mocked_private_key",
    })),
  })),
  GetSecretValueCommand: jest.fn(),
}));

// Mocking the jwt.sign function
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mocked_signed_jwt"),
}));

// Your test suite
describe("All Tests", () => {
  describe("handler function", () => {
    const mockEvent = {};
    const originalEnv = { ...process.env };

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = {
        // Setting up environment variables for testing
        CIS2_ID: "mocked_client_id",
        CIS2_TOKEN_ENDPOINT_URL: "mocked_token_endpoint_url",
        CIS2_PUBLIC_KEY_ID: "mocked_kid",
        CIS2_KNAME: "mocked_secret_name",
      };
    });

    afterAll(() => {
      process.env = originalEnv; // Restoring original environment variables
    });

    test("should return a valid response", async () => {
      const response = await handler(mockEvent);

      expect(response.statusCode).toBe(200);
      expect(response.isBase64Encoded).toBe(true);
      expect(typeof response.body).toBe("string");
    });
  });

  describe("getSecret", () => {
    const mockSecretName = "mocked_secret_name";
    afterEach(() => {
      jest.clearAllMocks();
    });

    test("should return secret value when successful", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const expectedResult = "mocked_private_key";
      const smClient = {
        send: jest
          .fn()
          .mockResolvedValue({ SecretString: "mocked_private_key" }),
      };

      const result = await getSecret(mockSecretName, smClient);

      expect(result).toEqual(expectedResult);
      expect(logSpy).toHaveBeenCalledWith(
        `Retrieved value successfully ${mockSecretName}`
      );
    });
    test("Failure when retrieving secret", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const errorMsg = new Error("Failed to retrieve secret to S3");
      const smClient = {
        send: jest.fn().mockRejectedValue(errorMsg),
      };
      try {
        const response = await getSecret("MESH_SENDER_CERT", smClient);
      } catch (error) {
        expect(error.message).toBe("Failed to retrieve secret to S3");
      }
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "Failed: Error: Failed to retrieve secret to S3"
      );
    });
  });

  describe("generateJWT function", () => {
    test("should generate JWT", () => {
      const clientId = "mocked_client_id";
      const tokenEndpointUrl = "mocked_token_endpoint_url";
      const publicKeyId = "mocked_kid";
      const privateKey = "mocked_private_key";

      const jwt = generateJWT(
        clientId,
        tokenEndpointUrl,
        publicKeyId,
        privateKey
      );

      expect(jwt).toBeTruthy();
    });
  });

  describe("createResponse function", () => {
    test("should create a valid response object", () => {
      const httpStatusCode = 200;
      const body = "mocked_body";

      const response = createResponse(httpStatusCode, body);

      expect(response.statusCode).toBe(httpStatusCode);
      expect(response.isBase64Encoded).toBe(true);
      expect(response.body).toBe(body);
    });
  });
});
