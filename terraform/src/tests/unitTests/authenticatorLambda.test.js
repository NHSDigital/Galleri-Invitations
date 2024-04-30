import {
  handler,
  getCIS2SignedJWT,
  getSecret,
  generateJWT,
  createResponse,
  getTokens,
  getUserinfo,
  getUserRole,
  checkAuthorization,
  extractClaims,
  validateTokenExpirationWithAuthTime,
  validateTokenSignature,
} from "../../authenticatorLambda/authenticatorLambda";
import jwt from "jsonwebtoken";
import axios from "axios";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

// Mock env variables
process.env.CIS2_ID = "test_client_id";
process.env.CIS2_TOKEN_ENDPOINT_URL = "test_token_endpoint_url";
process.env.CIS2_PUBLIC_KEY_ID = "test_public_key_id";
process.env.CIS2_KEY_NAME = "test_private_key_secret_name";
process.env.CIS2_REDIRECT_URL = "test_redirect_url";
process.env.GALLERI_ACTIVITY_CODE = "test_activity_code";
process.env.ENVIRONMENT = "test_environment";

// Mock DBClient and GetItemCommand
jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(),
  GetItemCommand: jest.fn(() => ({
    Key: { UUID: { S: "testUUID" } },
    TableName: "test-UserAccounts",
  })),
}));

// Mock Umnarshall
jest.mock("@aws-sdk/util-dynamodb", () => ({
  unmarshall: jest.fn(),
}));

// Mock axios
jest.mock("axios");

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

// Mocking User Object and other Frontend Auth variables
const mockUser = {
  sub: "user123",
  activityCodes: ["code1", "code2"],
  accountStatus: "Active",
  role: "Invitation Planner",
};
const mockAccount = { id_token: "mockToken" };
const mockClientID = "someAudience";
const mockGalleriActivityCode = "code1";

// Mock parseTokenClaims function
const mockParseTokenClaims = jest.fn().mockResolvedValue({
  iss: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare",
  aud: "someAudience",
  sub: "user123",
  authentication_assurance_level: "3",
});

// Mock parseTokenClaims function
const mockvalidateTokenSign = jest.fn().mockResolvedValue({
  iss: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare",
  aud: "someAudience",
  sub: "user123",
  authentication_assurance_level: "3",
});

// Mock checkTokenExpiration function
const mockCheckTokenExpirationWithAuthTime = jest.fn().mockResolvedValue(true);

// Mock the jwksClient and jwt libraries
jest.mock("jwks-rsa");
jest.mock("jsonwebtoken");

describe("All Test", () => {
  describe("handler", () => {
    const getSecret = jest.fn();
    const getCIS2SignedJWT = jest.fn();
    const getTokens = jest.fn();
    const getUserinfo = jest.fn();
    const getUserRole = jest.fn();
    const checkAuthorization = jest.fn();

    test("should return authResponse object if all functions are successful", async () => {
      // Mock event object
      const event = {
        queryStringParameters: {
          code: "yourAuthorizationCode",
        },
      };

      // Mock the return values of the mocked functions
      const mockedCIS2ClientID = "yourCIS2ClientID";
      const mockedSignedJWT = { body: "yourSignedJWT" };
      const mockedTokens = { accessToken: "yourAccessToken" };
      const mockedUserInfo = {
        uid: "yourUid",
        nhsid_nrbac_roles: [{ activity_codes: ["yourActivityCode"] }],
      };
      const mockedUserRole = {
        Role: "yourRole",
        Name: "yourName",
        Email: "yourEmail",
        Status: "yourStatus",
      };

      // Mock the implementations functions called inside the handler
      getSecret.mockResolvedValue(mockedCIS2ClientID);
      getCIS2SignedJWT.mockResolvedValue(mockedSignedJWT);
      getTokens.mockResolvedValue({ tokens: mockedTokens });
      getUserinfo.mockResolvedValue(mockedUserInfo);
      getUserRole.mockResolvedValue(mockedUserRole);
      checkAuthorization.mockResolvedValue(true);

      // Call the handler function with the mock event
      const result = await handler(
        event,
        getSecret,
        getCIS2SignedJWT,
        getTokens,
        getUserinfo,
        getUserRole,
        checkAuthorization
      );
    });
  });
  describe("extractClaims", () => {
    test("should correctly extract claims from the ID token", async () => {
      const extractClaims = jest.fn().mockResolvedValue({
        sub: 1234567890,
        name: "John Doe",
        iat: 1516239022,
      });
      // Expected claims from the ID token
      const expectedClaims = {
        sub: 1234567890,
        name: "John Doe",
        iat: 1516239022,
      };

      const claims = await extractClaims();
      expect(claims).toEqual(expectedClaims);
    });

    test("should throw an error if the ID token is invalid", async () => {
      // Mock invalid ID token
      const idToken = "invalidToken";

      await expect(extractClaims(idToken)).rejects.toThrow();
    });
  });

  describe("validateTokenExpirationWithAuthTime", () => {
    test("validates token expiration and authentication time", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 3600; // Set expiration time to be 1 hour from current time
      const authTime = currentTime - 5 * 60; // Set authentication time to be 5 minutes ago

      const token = {
        exp: expirationTime,
        auth_time: authTime,
      };
      const result = await validateTokenExpirationWithAuthTime(token);
      expect(result).toBe(true);
    });

    test("fails when expiration time is missing", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const authTime = currentTime - 5 * 60; // Set authentication time to be 5 minutes ago

      const token = { auth_time: authTime };
      const result = await validateTokenExpirationWithAuthTime(token);
      expect(result).toBe(false);
    });

    test("fails when authentication time is missing", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 3600; // Set expiration time to be 1 hour from current time

      const token = { exp: expirationTime };
      const result = await validateTokenExpirationWithAuthTime(token);
      expect(result).toBe(false);
    });

    test("fails when expiration time is invalid", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime - 3600; // Set expiration time to be 1 hour ago
      const authTime = currentTime - 5 * 60; // Set authentication time to be 5 minutes ago

      const token = { exp: expirationTime, auth_time: authTime };

      const result = await validateTokenExpirationWithAuthTime(token);
      expect(result).toBe(false);
    });

    test("fails when authentication time is invalid", async () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const expirationTime = currentTime + 3600; // Set expiration time to be 1 hour from current time
      const authTime = currentTime - 20 * 60; // Set authentication time to be 20 minutes ago

      const token = { exp: expirationTime, auth_time: authTime };
      const result = await validateTokenExpirationWithAuthTime(token);
      expect(result).toBe(false);
    });
  });

  describe("checkAuthorization", () => {
    test('returns "/autherror/activity_code_missing" if activity code is missing', async () => {
      const user = {
        activityCodes: [],
        sub: "user123",
        accountStatus: "Active",
        role: "Invitation Planner",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(
        "/autherror/activity_code_missing?error=Galleri+activity+code+missing+or+authentication+is+not+L3"
      );
    });

    test('returns "/autherror/activity_code_missing" if authentication assurance level is not 3', async () => {
      const user = {
        activityCodes: ["RICE123"],
        sub: "user123",
        accountStatus: "Active",
        role: "Invitation Planner",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";
      const extractClaims = jest.fn().mockResolvedValue({
        iss: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare",
        aud: "someAudience",
        sub: "user123",
        authentication_assurance_level: "2",
      });

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        extractClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(
        "/autherror/activity_code_missing?error=Galleri+activity+code+missing+or+authentication+is+not+L3"
      );
    });
    test("should return true if user is authorized and token is valid", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      const result = await checkAuthorization(
        mockUser,
        mockAccount,
        mockGalleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );
      expect(result).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(
        "Authorization Checks were successful"
      );
      expect(mockParseTokenClaims).toHaveBeenCalledWith(mockAccount.id_token);
      expect(mockCheckTokenExpirationWithAuthTime).toHaveBeenCalledWith(
        expect.objectContaining({
          iss: expect.any(String),
          aud: expect.any(String),
          sub: expect.any(String),
          authentication_assurance_level: expect.any(String),
        })
      );
    });

    test('returns false if user account is active, but role is not "Invitation Planner" or "Referring Clinician"', async () => {
      const user = {
        activityCodes: ["RICE123"],
        sub: "user123",
        accountStatus: "Active",
        role: "someRole",
      };

      const galleriActivityCode = "RICE123";
      const result = await checkAuthorization(
        user,
        mockAccount,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(false);
    });

    test("returns false if user account is active, but ID token validation fails", async () => {
      const account = { id_token: "sampleIdToken" };
      const mockParseTokenClaims = jest.fn().mockResolvedValue({
        iss: "https://am.nhsdev.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/oidc",
        aud: "",
        sub: "user123",
        authentication_assurance_level: "1",
      });
      const result = await checkAuthorization(
        mockUser,
        account,
        mockGalleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime
      );

      expect(result).toBe("/autherror?error=ID+Token+Validation+failed");
    });

    test('returns "/autherror/account_not_found" if user account is inactive', async () => {
      const user = {
        sub: "user123",
        role: "Invitation Planner",
        activityCodes: ["RICE123"],
        accountStatus: "Inactive",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(
        "/autherror/account_not_found?error=User+Account+does+not+exist+or+is+inactive"
      );
    });

    test("returns sub claim fail error when sub claim from userinfo response does not match in ID token", async () => {
      const user = {
        sub: "",
        role: "Invitation Planner",
        activityCodes: ["RICE123"],
        accountStatus: "Inactive",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(
        "/autherror?error=Userinfo+sub+claim+does+not+match+in+the+ID+Token"
      );
    });

    test('returns true if user role is "Invitation Planner"', async () => {
      const user = {
        sub: "user123",
        activityCodes: ["RICE123"],
        accountStatus: "Active",
        role: "Invitation Planner",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(true);
    });

    test("returns ID token expiration error message when validateTokenExpiration evaluates False", async () => {
      const user = {
        sub: "user123",
        activityCodes: ["RICE123"],
        accountStatus: "Active",
        role: "Invitation Planner",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";
      // Mock checkTokenExpiration function
      const mockCheckTokenExpiration = jest.fn().mockResolvedValue(false);

      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpiration,
        mockvalidateTokenSign
      );

      expect(result).toBe("/autherror?error=Token+session+has+expired");
    });

    test('returns true if user role is "Referring Clinician"', async () => {
      const user = {
        sub: "user123",
        activityCodes: ["RICE123"],
        accountStatus: "Active",
        role: "Referring Clinician",
      };
      const account = { id_token: "sampleIdToken" };
      const galleriActivityCode = "RICE123";
      const result = await checkAuthorization(
        user,
        account,
        galleriActivityCode,
        mockClientID,
        mockParseTokenClaims,
        mockCheckTokenExpirationWithAuthTime,
        mockvalidateTokenSign
      );

      expect(result).toBe(true);
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

  describe("getTokens function", () => {
    it("should return tokens when authentication code is valid", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      // Mocking the axios POST request response
      axios.mockResolvedValueOnce({
        data: {
          access_token: "mock_access_token",
          refresh_token: "mock_refresh_token",
        },
      });

      // Mock inputs
      const authCode = "valid_auth_code";
      const signedJWT = "mock_signed_jwt";
      const cis2ClientID = "mock_cis2_client_id";

      const result = await getTokens(authCode, signedJWT, cis2ClientID);
      expect(result).toEqual({
        tokens: {
          access_token: "mock_access_token",
          refresh_token: "mock_refresh_token",
        },
      });
      expect(logSpy).toHaveBeenCalledWith(
        "Tokens have been successfully received"
      );
      expect(axios).toHaveBeenCalledTimes(1);
    });

    it("should throw an error when authentication code is invalid", async () => {
      // Mocking the axios POST request to throw an error
      axios.mockRejectedValueOnce(new Error("Request failed"));

      const authCode = "invalid_auth_code";
      const signedJWT = "mock_signed_jwt";
      const cis2ClientID = "mock_cis2_client_id";

      await expect(
        getTokens(authCode, signedJWT, cis2ClientID)
      ).rejects.toThrow("Request failed");
      expect(axios).toHaveBeenCalledTimes(2);
    });
  });

  describe("getUserinfo", () => {
    it("should return user information when the request is successful", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      // Mock expected user information response
      const userInfoResponse = {
        id: "123",
        name: "John Doe",
      };

      // Mock the axios request
      axios.mockResolvedValueOnce({ data: userInfoResponse });

      const tokens = { access_token: "mock_access_token" };
      const userInfo = await getUserinfo(tokens);
      expect(axios).toHaveBeenCalledWith({
        method: "GET",
        url: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare/userinfo?schema=openid",
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      expect(logSpy).toHaveBeenCalledWith(
        "User Information have been successfully received"
      );
      // Verify function returns the expected user information
      expect(userInfo).toEqual(userInfoResponse);
    });

    it("should throw an error when the request fails", async () => {
      // Mock error message
      const errorMessage = "Failed to get User Info";

      // Mock the axios request to throw an error
      axios.mockRejectedValueOnce(new Error(errorMessage));

      const tokens = { access_token: "mock_access_token" };
      try {
        await getUserinfo(tokens);
        // If no error is thrown, fail the test
        fail("getUserinfo should have thrown an error");
      } catch (error) {
        expect(error.message).toEqual(`Error: ${errorMessage}`);
      }
    });
  });

  describe("getUserRole", () => {
    it("should return user role when UUID exists", async () => {
      const logSpy = jest.spyOn(global.console, "log");
      process.env.ENVIRONMENT = "test";

      // Mock DynamoDBClient.send method to return a response with an item
      const mockSend = jest.fn().mockResolvedValue({
        Item: {
          Role: "testRole",
        },
      });
      DynamoDBClient.prototype.send = mockSend;

      // Mock unmarshall function to return a mock item
      unmarshall.mockReturnValueOnce({
        Role: "testRole",
      });

      const uuid = "testUUID";
      const result = await getUserRole(uuid);
      expect(result).toEqual({ Role: "testRole" });
      expect(logSpy).toHaveBeenCalledWith(
        "UUID exists on Galleri User database"
      );
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          TableName: "test-UserAccounts",
          Key: { UUID: { S: "testUUID" } },
        })
      );
    });

    it("should throw an error if DynamoDBClient.send() throws an error", async () => {
      jest.clearAllMocks();
      jest.mock("@aws-sdk/client-dynamodb", () => ({
        DynamoDBClient: jest.fn(() => ({
          send: jest.fn(),
        })),
        GetItemCommand: jest.fn(),
      }));

      // Mocking unmarshall function
      jest.mock("@aws-sdk/util-dynamodb", () => ({
        unmarshall: jest.fn(),
      }));
      const mockError = "Error: DynamoDB Error";
      DynamoDBClient.prototype.send.mockRejectedValue(mockError);
      const uuid = "123456";
      await expect(getUserRole(uuid)).rejects.toThrowError(mockError);
    });

    it("should throw an error if unmarshall function throws an error", async () => {
      const mockError = "Unmarshall Error";
      DynamoDBClient.prototype.send.mockResolvedValue({ Item: {} });
      unmarshall.mockImplementation(() => {
        throw mockError;
      });
      const uuid = "123456";

      await expect(getUserRole(uuid)).rejects.toThrowError(mockError);
    });

    it("should throw an error when DynamoDB fetch fails", async () => {
      jest.mock("@aws-sdk/client-dynamodb", () => ({
        DynamoDBClient: jest.fn(() => ({
          send: jest.fn().mockRejectedValue(new Error("DynamoDB error")), // Simulate a rejected promise with an error
        })),
      }));
      const uuid = "testUUID";
      await expect(getUserRole(uuid)).rejects.toThrowError("Unmarshall Error");
    });
  });

  describe("getCIS2SignedJWT", () => {
    test("should return signed JWT if all functions are successful", async () => {
      // Mock env vars
      const PRIVATE_KEY_SECRET_NAME = "mockedPrivateKeySecretName";
      const TOKEN_ENDPOINT_URL = "mockedTokenEndpointUrl";
      const KID = "mockedKID";

      // Mock functions
      const getSecret = jest.fn().mockResolvedValue("mockedPrivateKey");
      const generateJWT = jest.fn().mockReturnValue("mockedSignedJWT");
      const createResponse = jest.fn().mockReturnValue("mockedResponseObject");

      const result = await getCIS2SignedJWT(
        "mockedCIS2ClientID",
        getSecret,
        generateJWT,
        createResponse,
        PRIVATE_KEY_SECRET_NAME,
        TOKEN_ENDPOINT_URL,
        KID
      );
      expect(getSecret).toHaveBeenCalledWith(
        PRIVATE_KEY_SECRET_NAME,
        expect.anything()
      );
      expect(generateJWT).toHaveBeenCalledWith(
        "mockedCIS2ClientID",
        TOKEN_ENDPOINT_URL,
        KID,
        "mockedPrivateKey"
      );
      expect(createResponse).toHaveBeenCalledWith(200, "mockedSignedJWT");
      expect(result).toBe("mockedResponseObject");
    });

    test("should return error response if getSecret throws an error", async () => {
      const PRIVATE_KEY_SECRET_NAME = "mockedPrivateKeySecretName";
      const TOKEN_ENDPOINT_URL = "mockedTokenEndpointUrl";
      const KID = "mockedKID";

      // Mock getSecret to throw an error
      const getSecret = jest.fn().mockRejectedValue(new Error("Mocked error"));
      const generateJWT = jest.fn().mockReturnValue("mockedSignedJWT");
      const createResponse = jest
        .fn()
        .mockReturnValue({ body: "Mocked error", statusCode: 500 });

      const result = await getCIS2SignedJWT(
        "mockedCIS2ClientID",
        getSecret,
        generateJWT,
        createResponse,
        PRIVATE_KEY_SECRET_NAME,
        TOKEN_ENDPOINT_URL,
        KID
      );
      expect(result).toEqual(
        expect.objectContaining({
          statusCode: 500,
          body: expect.stringContaining("Mocked error"),
        })
      );
    });
  });

  describe("validateTokenSignature function", () => {
    test("should validate the token signature", async () => {
      const idToken = "mocked_id_token";
      const jwksUri = "mocked_jwks_uri";

      // Mock signing key
      const mockSigningKey = "mocked_signing_key";

      // Mock the client.getSigningKey function
      const getSigningKeyMock = jest
        .fn()
        .mockImplementation((header, callback) => {
          callback(null, { publicKey: mockSigningKey });
        });

      // Mock the jwksClient function to return the mocked getSigningKey function
      const jwksClientMock = jest
        .fn()
        .mockReturnValue({ getSigningKey: getSigningKeyMock });
      require("jwks-rsa").mockImplementation(jwksClientMock);

      // Mock the jwt.verify function
      const decodedMock = {};
      const jwtVerifyMock = jest
        .fn()
        .mockImplementation((token, getKey, callback) => {
          callback(null, decodedMock);
        });
      require("jsonwebtoken").verify = jwtVerifyMock;

      const result = await validateTokenSignature(idToken, jwksUri);
      expect(result).toEqual(decodedMock);
      expect(jwksClientMock).toHaveBeenCalledWith({ jwksUri });
      expect(getSigningKeyMock).not.toHaveBeenCalled();
      expect(jwtVerifyMock).toHaveBeenCalledWith(
        idToken,
        expect.any(Function),
        expect.any(Function)
      );
    });

    test("should throw an error if getKeyCallback returns an error", async () => {
      // Mocking the jwksClient function to return an object with getSigningKey function
      const jwksClientMock = jest.fn(() => ({
        getSigningKey: (header, getKeyCallback) => {
          const err = new Error("Sample error message");
          getKeyCallback(err); // Simulating an error
        },
      }));

      // Mocking jwt.verify to call the error callback
      const jwtVerifyMock = jest
        .spyOn(jwt, "verify")
        .mockImplementation((idToken, getKey, callback) => {
          const err = new Error("Sample error message");
          callback(err); // Simulating an error
        });

      // Mocking console.error to suppress console logs
      const consoleErrorMock = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        validateTokenSignature("sample-id-token", "sample-jwks-uri")
      ).rejects.toThrowError("Sample error message");

      jest.restoreAllMocks();
    });
  });
});
