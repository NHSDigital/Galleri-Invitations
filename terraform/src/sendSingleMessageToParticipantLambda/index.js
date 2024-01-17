const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const axios = require('axios').default;
const qs = require('qs');

const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');

const handler = async(event) => {
  try {
    const privateKey = await getSecretValue();
    const signedJWT = generateJWT(process.env.API_KEY, process.env.TOKEN_ENDPOINT_URL, process.env.PUBLIC_KEY_ID, privateKey);
    const accessToken = await getAccessToken(process.env.TOKEN_ENDPOINT_URL, signedJWT);
    return accessToken;
  } catch (error) {
    console.error(error.message);
    return undefined;
  }
};

const getSecretValue = async (secretName = process.env.PRIVATE_KEY_SECRET_NAME) => {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    }),
  );
  if (response.SecretString) return response.SecretString;
};

const generateJWT = (apiKey, tokenEndpointUrl, publicKeyId, privateKey) => {
  const expiration = Math.floor(new Date().getTime() / 1000) + (5 * 60);
  const claims = {
    "sub": apiKey,
    "iss": apiKey,
    "jti": uuidv4(),
    "aud": tokenEndpointUrl,
    "exp":  expiration,/* 5mins in the future */
  };

  const signedJWT = jwt.sign(claims, privateKey, { algorithm: "RS512", header: { kid: publicKeyId } });
  return signedJWT;
};

const getAccessToken = async (tokenEndpointUrl, signedJWT) => {
  const data = {
    'grant_type': 'client_credentials',
    'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    'client_assertion': signedJWT
  };

  const config = {
    method: 'post',
    url: tokenEndpointUrl,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    data: qs.stringify(data)
  };

  const response = await axios(config)
  console.log(response);
  if (response.status === 200) {
    return response.data;
  } else {
    return undefined;
  }
};

exports.handler = handler;
