import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import axios from "axios";
import jwt from "jsonwebtoken";
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
const CIS2_REDIRECT_URL = "http://localhost:3000/api/auth/callback/cis2";
const GALLERI_ACTIVITY_CODE = process.env.GALLERI_ACTIVITY_CODE;
const GALLERI_ACTIVITY_NAME = process.env.GALLERI_ACTIVITY_NAME;

export const handler = async (event) => {
  const code = event.queryStringParameters.code;
  console.log("Code :", code);
  const signedJWT = await getCIS2SignedJWT();
  console.log("signedJWT :", signedJWT.body);
  const { tokens } = await getTokens(code, signedJWT.body);
  console.log("tokens :", tokens);
  const userInfo = await getUserinfo(tokens);
  console.log("userInfo :", userInfo);
  const uuid = userInfo.uid.replace(/(.{4})/g, "$1 ").trim();
  const userRole = await getUserRole(uuid);
  console.log("userRole :", userRole);
  return { statusCode: 200, body: JSON.stringify(userInfo) };
};

export async function getCIS2SignedJWT() {
  try {
    console.log("Getting CIS2 signed jwt");
    const privateKey = await getSecret(PRIVATE_KEY_SECRET_NAME, smClient);
    const cis2ClientID = await getSecret(CLIENT_ID, smClient);
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
    console.error(`Error getting CIS2 signed jwt: ${error}`);
    const responseObject = createResponse(500, error.message);
    return responseObject;
  }
}

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
    console.log(`Failed: ${error}`);
    throw error;
  }
};

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

export async function getTokens(authCode, signedJWT) {
  const cis2ClientID = await getSecret(CLIENT_ID, smClient);
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
    return { tokens: r.data };
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
}

export async function getUserinfo(tokens) {
  try {
    const response = await axios({
      method: "GET",
      url: "https://am.nhsint.auth-ptl.cis2.spineservices.nhs.uk:443/openam/oauth2/realms/root/realms/NHSIdentity/realms/Healthcare/userinfo?schema=openid",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });
    return response.data;
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
}

export async function getUserRole(uuid) {
  console.log(environment);
  console.log(typeof uuid);
  const params = {
    TableName: `${environment}-UserAccounts`,
    Key: {
      UUID: { S: uuid },
    },
  };
  console.log(params);

  console.log("UUID from query string parameters is: ", uuid);

  try {
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);
    console.log(data);

    if (!data.Item) {
      return console.error("User not found");
    }

    const item = unmarshall(data.Item);

    return JSON.stringify(item);
  } catch (error) {
    console.error("Error getting item from DynamoDB:", error);
    throw new Error(error);
  }
}

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
  } else {
    // For Local auth below as no need to check all the Token claims as above
    if (!user.activityCodes.includes(galleriActivityCode)) {
      return "/autherror/activity_code_missing?error=Galleri+activity+code+missing+or+authentication+is+not+L3";
    }
  }

  // not active or user account does not exist
  if (
    user.accountStatus === "Inactive" ||
    user.accountStatus === "User Not Found"
  ) {
    return "/autherror/account_not_found?error=User+Account+does+not+exist+or+is+inactive";
    // Keeping this here in case we want to route different users to different pages for referrals repo
  } else if (
    user.role === "Invitation Planner" ||
    user.role === "Referring Clinician"
  ) {
    return true;
  } else {
    return false;
  }
}

// Function to extract the Token ID claims
export async function extractClaims(idToken) {
  // Split the ID token into its parts: header, payload, and signature
  const [header, payload, signature] = idToken.split(".");

  // Base64 decode the payload
  const decodedPayload = Buffer.from(payload, "base64").toString("utf-8");

  // Parse the decoded payload as JSON to obtain the claims
  const claims = JSON.parse(decodedPayload);
  return claims;
}

// Function to validate the expiration time (exp claim)
export async function validateTokenExpirationWithAuthTime(token) {
  console.log(token);
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

// Function to validate the signature of id token received
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
    console.error("Error validating ID token signature:", error.message);
    throw error;
  }
}