import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import axios from "axios";
import jwksClient from "jwks-rsa";

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const environment = process.env.ENVIRONMENT;
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const CLIENT_ID = process.env.CIS2_ID;
const TOKEN_ENDPOINT_URL = process.env.CIS2_TOKEN_ENDPOINT_URL;
const KID = process.env.CIS2_PUBLIC_KEY_ID;
const PRIVATE_KEY_SECRET_NAME = process.env.CIS2_KEY_NAME;
const CIS2_REDIRECT_URL = process.env.CIS2_REDIRECT_URL;
const GALLERI_ACTIVITY_CODE = process.env.GALLERI_ACTIVITY_CODE;

/**
 * Lambda handler function for Oauth authentication token handling,
 * userinfo exchange, perform authorization checks and creates
 * API Gateway lockdown sessions.
 *
 * @function handler
 * @async
 * @param {Object} event - The event object containing the query parameters and other details.
 * @returns {Object} HTTP response object with user authentication and authorization details.
 */
export const handler = async (event) => {
  try {
    let apiSessionId;
    const cis2ClientID = await getSecret(CLIENT_ID, smClient);
    const code = event.queryStringParameters.code; // getting authorization code from Query parameter
    // getting signed private key JWT
    const signedJWT = await getCIS2SignedJWT(
      cis2ClientID,
      getSecret,
      generateJWT,
      createResponse,
      PRIVATE_KEY_SECRET_NAME,
      TOKEN_ENDPOINT_URL,
      KID
    );
    const { tokens } = await getTokens(code, signedJWT.body, cis2ClientID); // getting tokens from CIS2
    const userInfo = await getUserinfo(tokens); // exchanging the access token for user Info
    const uuid = userInfo.uid.replace(/(.{4})(?!$)/g, "$1 ");
    const userRole = await getUserRole(uuid); // matching the user id from CIS2 with GPS user data base to grab the status and role
    const userAuthData = {
      sub: userInfo.sub,
      role: userRole.Role,
      activityCodes: userInfo.nhsid_nrbac_roles[0].activity_codes,
      accountStatus: userRole.Status,
    };
    const checkAuthorizationResult = await checkAuthorization(
      userAuthData,
      tokens,
      GALLERI_ACTIVITY_CODE,
      cis2ClientID,
      extractClaims,
      validateTokenExpirationWithAuthTime,
      validateTokenSignature
    );
    if (checkAuthorizationResult !== true) {
      const errorMessage = checkAuthorizationResult
        .split("error=")[1]
        .replace(/\+/g, " ");
      console.error("Error: ", errorMessage);
    } else {
      apiSessionId = uuidv4();
      await generateAPIGatewayLockdownSession(
        environment,
        dynamoDBClient,
        apiSessionId,
        userInfo.uid,
        updateAPIGatewayLockdownSessionTable
      );
      console.log(
        `This User has been authenticated and is authorized to access the MCBT App with role - ${userRole.Role}`
      );
    }
    const authResponse = {
      id: userInfo.uid,
      name: userRole.Name,
      email: userRole.Email,
      role: userRole.Role,
      isAuthorized: checkAuthorizationResult,
      apiSessionId: apiSessionId,
    };
    return { statusCode: 200, body: JSON.stringify(authResponse) };
  } catch (error) {
    console.error("Error: ", error);
  }
};

//FUNCTIONS

/**
 * Generates a session for API Gateway Lock-down.
 *
 * @function generateAPIGatewayLockdownSession
 * @async
 * @param {string} environment - The environment name.
 * @param {DynamoDBClient} client - The DynamoDB client.
 * @param {string} apiSessionId - The API session ID.
 * @param {string} userId - The user ID.
 * @param {Function} updateAPISessionTable - The function to update the API session table.
 * @throws {Error} If there is an error creating session.
 */
export async function generateAPIGatewayLockdownSession(
  environment,
  client,
  apiSessionId,
  userId,
  updateAPISessionTable
) {
  try {
    // Current DateTime
    const dateTime = new Date(Date.now()).toISOString();

    // TODO: After confirming the session duration update the timeToLive & expirationDateTime below
    // Unix epoch timestamp that is 20 minutes (1200 seconds) in the future from the current time
    const timeToLive = Math.floor(Date.now() / 1000) + 1200;

    // ISO string format timestamp that is 20 minutes (1200 seconds) in the future from the current time
    const expirationDateTime = new Date(Date.now() + 20 * 60000).toISOString();

    const updateSessionTable = await updateAPISessionTable(
      environment,
      client,
      apiSessionId,
      userId,
      timeToLive,
      expirationDateTime,
      dateTime,
      dateTime
    );
    if (updateSessionTable !== 200) {
      console.error(`Error: Failed to generate session for for User ${userId}`);
      return;
    }
    console.log(
      `API Gateway Lockdown session ${apiSessionId}, generated successfully for User ${userId}`
    );
  } catch (error) {
    console.error(`Error: Failed to generate session for for User ${userId}`);
    console.error(`Error:`, error);
    throw error;
  }
}

/**
 * Updates the API Gateway Lock-down Session Table.
 *
 * @function updateAPIGatewayLockdownSessionTable
 * @async
 * @param {string} environment - The environment name.
 * @param {DynamoDBClient} client - The DynamoDB client.
 * @param {string} apiSessionId - The API session ID.
 * @param {string} userId - The user ID.
 * @param {number} timeToLive - The time to live for the session.
 * @param {string} expirationDateTime - The expiration date and time.
 * @param {string} creationDateTime - The creation date and time.
 * @param {string} updatedDateTime - The last updated date and time.
 * @returns {number} The HTTP status code of the update operation.
 */
export async function updateAPIGatewayLockdownSessionTable(
  environment,
  client,
  apiSessionId,
  userId,
  timeToLive,
  expirationDateTime,
  creationDateTime,
  updatedDateTime
) {
  const params = {
    TableName: `${environment}-APIGatewayLockdownSession`,
    Key: {
      API_Session_Id: {
        S: apiSessionId,
      },
    },
    ExpressionAttributeNames: {
      "#USER": "User_UUID",
      "#TTL": "Expires_At",
      "#EXPIRES": "Expiration_DateTime",
      "#CREATED": "Creation_DateTime",
      "#UPDATED": "Last_Updated_DateTime",
    },
    ExpressionAttributeValues: {
      ":user": {
        S: userId,
      },
      ":ttl": {
        N: timeToLive.toString(),
      },
      ":expires": {
        S: expirationDateTime,
      },
      ":created": {
        S: creationDateTime,
      },
      ":updated": {
        S: updatedDateTime,
      },
    },
    UpdateExpression:
      "SET #USER = :user, #TTL = :ttl, #EXPIRES = :expires, #CREATED = :created, #UPDATED = :updated",
  };
  const command = new UpdateItemCommand(params);
  const response = await client.send(command);
  if (response.$metadata.httpStatusCode != 200) {
    console.error(
      `Error: Failed to update the API Gateway Lockdown Session for User ${userId}`
    );
  }
  return response.$metadata.httpStatusCode;
}

/**
 * Generates a JWT signed by a private key.
 *
 * @function getCIS2SignedJWT
 * @async
 * @param {string} cis2ClientID - The CIS2 client ID.
 * @param {Function} getSecret - The function to retrieve a secret.
 * @param {Function} generateJWT - The function to generate a JWT.
 * @param {Function} createResponse - The function to create an HTTP response.
 * @param {string} PRIVATE_KEY_SECRET_NAME - The name of the secret containing the private key.
 * @param {string} TOKEN_ENDPOINT_URL - The token endpoint URL.
 * @param {string} KID - The key ID.
 * @returns {Object} The HTTP response object containing the signed JWT.
 */
export async function getCIS2SignedJWT(
  cis2ClientID,
  getSecret,
  generateJWT,
  createResponse,
  PRIVATE_KEY_SECRET_NAME,
  TOKEN_ENDPOINT_URL,
  KID
) {
  try {
    console.log("Getting CIS2 signed jwt");
    const privateKey = await getSecret(PRIVATE_KEY_SECRET_NAME, smClient);
    const signedJWT = generateJWT(
      cis2ClientID,
      TOKEN_ENDPOINT_URL,
      KID,
      privateKey
    );
    const responseObject = createResponse(200, signedJWT);

    console.log("Returning CIS2 signed jwt");
    return responseObject;
  } catch (error) {
    console.error(`Error getting CIS2 signed jwt`);
    console.error(`Error: ${error}`);
    const responseObject = createResponse(500, error.message);
    return responseObject;
  }
}

/**
 * Retrieves 'Secret value' from secrets manager by passing in 'Secret name' from AWS Secrets Manager
 *
 * @function getSecret
 * @async
 * @param {string} secretName - Name of the secret to retrieve
 * @param {SecretsManagerClient} client - Secrets Manager client
 * @returns {string} Secret value
 * @throws {Error} If there is an error retrieving the secret
 */
export const getSecret = async (secretName, client) => {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log(`Error: ${error}`);
    throw error;
  }
};

/**
 * Generates a JSON Web Token (JWT) signed with the provided private key.
 *
 * @function generateJWT
 * @param {string} clientID - The client ID for the JWT payload.
 * @param {string} tokenEndpointUrl - The token endpoint URL for the JWT payload.
 * @param {string} keyId - The key ID for the JWT header.
 * @param {string} privateKey - The private key to sign the JWT.
 * @returns {string} The signed JWT.
 */
export const generateJWT = (
  clientId,
  tokenEndpointUrl,
  publicKeyId,
  privateKey
) => {
  const expiration = Math.floor(new Date().getTime() / 1000) + 5 * 60;
  const claims = {
    sub: clientId,
    iss: clientId,
    jti: uuidv4(),
    aud: tokenEndpointUrl,
    exp: expiration,
  };

  const signedJwt = jwt.sign(claims, privateKey, {
    algorithm: "RS512",
    header: { kid: publicKeyId },
  });
  return signedJwt;
};

/**
 * Creates an HTTP response object.
 *
 * @function createResponse
 * @param {number} statusCode - The HTTP status code.
 * @param {Object|string} body - The body of the HTTP response.
 * @returns {Object} The HTTP response object.
 */
export const createResponse = (httpStatusCode, body) => {
  const responseObject = {};
  responseObject.statusCode = httpStatusCode;
  responseObject.headers = {
    "Access-Control-Allow-Headers":
      "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,GET",
  };
  responseObject.isBase64Encoded = true;
  responseObject.body = body;
  return responseObject;
};

/**
 * Retrieves tokens from the authorization server using the authorization code from an OAuth provider(CIS2).
 *
 * @function getTokens
 * @async
 * @param {string} code - The authorization code.
 * @param {string} signedJWT - The signed JWT for client authentication.
 * @param {string} clientID - The client ID.
 * @returns {Object} The response object containing tokens.
 * @throws {Error}
 */
export async function getTokens(authCode, signedJWT, cis2ClientID) {
  const body = {
    grant_type: "authorization_code",
    redirect_uri: CIS2_REDIRECT_URL,
    client_id: cis2ClientID || "undefined",
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: signedJWT || "undefined",
    code: authCode || "undefined",
  };
  const data = new URLSearchParams(body).toString();
  try {
    const r = await axios({
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      data,
      url: `https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare/access_token`,
    });
    console.log("Tokens have been successfully received");
    return { tokens: r.data };
  } catch (err) {
    console.error("Failed to get Tokens from CIS2 Token Endpoint");
    console.error("Error: ", err);
    throw new Error(err);
  }
}

/**
 * Retrieves user information using the access token.
 *
 * @function getUserinfo
 * @async
 * @param {Object} tokens - The tokens object containing the access token.
 * @returns {Object} The user information.
 * @throws {Error}
 */
export async function getUserinfo(tokens) {
  try {
    const response = await axios({
      method: "GET",
      url: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare/userinfo?schema=openid",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    console.log("User Information have been successfully received");
    return response.data;
  } catch (err) {
    console.error("Failed to get User Info from CIS2 userInfo Endpoint");
    console.error("Error: ", err);
    throw new Error(err);
  }
}

/**
 * Retrieves the user's role from the database.
 *
 * @function getUserRole
 * @async
 * @param {string} uuid - The user's UUID.
 * @returns {Object} The user role object.
 * @throws {Error}
 */
export async function getUserRole(uuid) {
  const params = {
    TableName: `${environment}-UserAccounts`,
    Key: {
      User_UUID: { S: uuid },
    },
  };
  console.log("User UUID from query string parameters is: ", uuid);

  try {
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Item) {
      console.error("Error: User not found");
      return {
        Role: "",
        UUID: "",
        Status: "User Not Found",
        Email: "",
        Name: "",
      };
    }
    const item = unmarshall(data.Item);
    console.log("User exists on Galleri User database");

    return item;
  } catch (error) {
    console.error("Error getting User data from Galleri User database");
    console.error("Error: ", error);
    throw new Error(error);
  }
}

/**
 * Checks the authorization requirement of the user and validate the token claims and signature received from CIS2
 *
 * @function checkAuthorization
 * @async
 * @param {Object} user - The user authentication data.
 * @param {Object} account - The object containing tokens.
 * @param {string} galleriActivityCode - The required activity code for authorization.
 * @param {string} clientID - The client ID.
 * @param {Function} parseTokenClaims - The function to extract claims from the ID token.
 * @param {Function} checkTokenExpirationWithAuthTime - The function to validate token expiration with auth time.
 * @param {Function} verifyTokenSignature - The function to validate the token signature.
 * @returns {boolean|string} True if authorized, otherwise an error message.
 */
export async function checkAuthorization(
  user,
  account,
  galleriActivityCode,
  clientID,
  parseTokenClaims,
  checkTokenExpirationWithAuthTime,
  verifyTokenSignature
) {
  // Care Identity Authentication OpenID Provider's Issue identifier as specified in the OpenID Provider Configuration Document.
  const INT_iss =
    "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare";
  // ID Token claims Validation
  if (account.id_token) {
    const idTokenPayload = await parseTokenClaims(account.id_token);
    if (idTokenPayload?.iss !== INT_iss || idTokenPayload?.aud !== clientID) {
      return "/autherror?error=ID+Token+Validation+failed";
    }

    // User Info claims Validation
    if (idTokenPayload?.sub !== user.sub) {
      return "/autherror?error=Userinfo+sub+claim+does+not+match+in+the+ID+Token";
    }

    // Validate the token's expiration time
    const isValidTokenExpirationWithAuthTime =
      await checkTokenExpirationWithAuthTime(idTokenPayload);
    if (!isValidTokenExpirationWithAuthTime) {
      return "/autherror?error=Token+session+has+expired";
    }

    // Validate the Signature of ID Token
    const jwksUri =
      "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare/connect/jwk_uri";
    await verifyTokenSignature(account.id_token, jwksUri);

    // does not have the activity code or authentication assurance is not level 3
    // TODO: After moving to INT env change the check below to see if authentication_assurance_level is level 3
    if (
      !user.activityCodes.includes(galleriActivityCode) ||
      idTokenPayload.authentication_assurance_level !== "3"
    ) {
      return "/autherror/activity_code_missing?error=Galleri+activity+code+missing+or+authentication+is+not+L3";
    }
  }

  // not active or user account does not exist
  if (user.accountStatus !== "Active") {
    return "/autherror/account_not_found?error=User+Account+does+not+exist+or+is+inactive";
    // Keeping this here in case we want to route different users to different pages for referrals repo
  } else if (
    user.role === "Invitation Planner" ||
    user.role === "Referring Clinician"
  ) {
    console.log("Authorization Checks were successful");
    return true;
  } else {
    console.error("Authorization Checks were unsuccessful");
    return false;
  }
}

/**
 * Extracts claims from the ID token.
 *
 * @function extractClaims
 * @async
 * @param {string} idToken - The ID token.
 * @returns {Object} The extracted claims.
 */
export async function extractClaims(idToken) {
  // Split the ID token into its parts: header, payload, and signature
  const [header, payload, signature] = idToken.split(".");

  // Base64 decode the payload
  const decodedPayload = Buffer.from(payload, "base64").toString("utf-8");

  // Parse the decoded payload as JSON to obtain the claims
  const claims = JSON.parse(decodedPayload);
  return claims;
}

/**
 * Validates the expiration of the token with the authentication time(exp claim).
 *
 * @function validateTokenExpirationWithAuthTime
 * @async
 * @param {string} token - The ID token.
 * @returns {boolean} True if the token is valid, otherwise false.
 */
export async function validateTokenExpirationWithAuthTime(token) {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const expirationTime = token?.exp; // Expiration time from the token's exp claim
  const authTime = token?.auth_time; // Authentication time from the token's auth_time claim

  if (!expirationTime || !authTime) {
    return false; // Return false if expiration time or auth time is missing
  }

  // Check if both expiration time and authentication time are valid and meet the criteria
  return (
    currentTime < expirationTime && authTime >= currentTime - 15 * 60 - 60 // Check if auth_time is within the last 15 minutes with 1-minute leeway
  );
}

/**
 * Validates the signature of the id token received.
 *
 * @function validateTokenSignature
 * @async
 * @param {string} idToken - The ID token.
 * @param {string} jwksUri - The endpoints to a set of JSON Web Keys (JWKs) which are used for verifying the signatures of JSON Web Tokens (JWTs).
 * @returns {boolean} True if the signature is valid, otherwise false.
 * @throws {Error}
 */
export async function validateTokenSignature(idToken, jwksUri) {
  try {
    // Function to get the key for verification
    const client = jwksClient({ jwksUri });
    function getKey(header, getKeyCallback) {
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          console.error("Error fetching signing key:", err);
          return getKeyCallback(err);
        }
        const signingKey = key.publicKey || key.rsaPublicKey;
        getKeyCallback(null, signingKey);
      });
    }

    // Verify the token using the callback-based approach
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(idToken, getKey, (err, decoded) => {
        if (err) {
          console.error("Error with JWT verify method:", err);
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });

    console.log("ID token signature is valid.");
    return decoded;
  } catch (error) {
    console.error("Error validating ID token signature");
    console.error("Error: ", error.message);
    throw new Error(error);
  }
}
//END OF FUNCTIONS
