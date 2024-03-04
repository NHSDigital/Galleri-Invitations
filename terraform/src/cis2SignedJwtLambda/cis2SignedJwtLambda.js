import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const CLIENT_ID = process.env.CIS2_CLIENT_ID;
const TOKEN_ENDPOINT_URL = process.env.CIS2_TOKEN_ENDPOINT_URL;
const KID = process.env.CIS2_PUBLIC_KEY_ID;
const PRIVATE_KEY_SECRET_NAME = process.env.CIS2_KNAME;

console.log("Client id: ", CLIENT_ID);
console.log("Token endpoing: ", TOKEN_ENDPOINT_URL);
console.log("Kid: ", KID);

export const handler = async (event) => {
  try {
    console.log("Getting CIS2 signed jwt");
    const privateKey = await getSecretValue(PRIVATE_KEY_SECRET_NAME);
    const signedJWT = generateJWT(CLIENT_ID, TOKEN_ENDPOINT_URL, KID, privateKey);
    const responseObject = createResponse(200, signedJWT);

    console.log("Returning CIS2 signed jwt");
    return responseObject;
  } catch (error) {
    console.error(`Error getting CIS2 signed jwt: ${error}`);
    const responseObject = createResponse(500, error.message);
    return responseObject;
  }
};

export const getSecretValue = async (secretName) => {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    }),
  );
  if (response.SecretString) {
    return response.SecretString;
  } else {
    throw new Error("Private key not found with secret id: ", secretName);
  }
};

export const generateJWT = (clientId, tokenEndpointUrl, publicKeyId, privateKey) => {
  const expiration = Math.floor(new Date().getTime() / 1000) + (5 * 60);
  const claims = {
    "sub": clientId,
    "iss": clientId,
    "jti": uuidv4(),
    "aud": tokenEndpointUrl,
    "exp": expiration,
  };

  const signedJwt = jwt.sign(claims, privateKey, { algorithm: "RS512", header: { kid: publicKeyId } });
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

