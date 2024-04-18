import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import axios from "axios";

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

export const handler = async (event) => {
  const code = event.queryStringParameters.code;
  console.log("Code :", code);
  const signedJWT = await getCIS2SignedJWT();
  console.log("signedJWT :", signedJWT);
  const { tokens } = await getTokens(code, signedJWT);
  console.log("tokens :", tokens);
  const userInfo = await getUserinfo(tokens);
  console.log("userInfo :", userInfo);
  return userInfo;
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
  const body = {
    grant_type: "authorization_code",
    redirect_uri: CIS2_REDIRECT_URL,
    client_id: process.env.CIS2_ID || "undefined",
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

export async function getUserRole(event) {
  const uuid = event.queryStringParameters.uuid;

  const params = {
    TableName: `${environment}-UserAccounts`,
    Key: {
      UUID: { S: uuid },
    },
  };

  console.log("UUID from query string parameters is: ", uuid);

  try {
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Item) {
      console.error("User not found");
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    const item = unmarshall(data.Item);

    return {
      statusCode: 200,
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error("Error getting item from DynamoDB:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
