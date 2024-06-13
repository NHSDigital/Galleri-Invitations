import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import { createPublicKey } from "crypto";

const client = new S3Client({});
const JWK_EXTENSION = "json";

/**
 * Lambda handler.
 *
 * @function getObjectKeys
 * @async
 * @returns {Promise<Object>} Promise resolves to API Gateway response.
 */
export const handler = async () => {
  try {
    console.log("Getting GPS public key jwks");
    const bucket = process.env.PUBLIC_KEYS_BUCKET;
    const publicKeyIds = await getObjectKeys(client, bucket);
    const publicKeyStrings = await getObjectStrings(
      client,
      bucket,
      publicKeyIds
    );
    const publicKeyJwks = exportJwks(publicKeyStrings);
    const responseObject = createResponse(200, publicKeyJwks);

    console.log(`Returning GPS public key jwks: ${responseObject.body}`);
    return responseObject;
  } catch (err) {
    console.error(`Error getting GPS public key jwks: ${err}`);
    const responseObject = createResponse(500, err.message);
    return responseObject;
  }
};

/**
 * Gets list of JWK object keys in a bucket.
 *
 * @function getObjectKeys
 * @async
 * @param {S3Client} client - An instance of the S3 client.
 * @param {string} bucket - Name of the bucket.
 * @returns {Promise<Array>} Promise resolves to array of object key strings.
 */
export const getObjectKeys = async (client, bucket) => {
  console.log("Getting object keys in bucket: ", bucket);
  const command = new ListObjectsV2Command({
    Bucket: bucket,
  });

  let isTruncated = true;
  let keys = [];

  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken } =
      await client.send(command);
    if (Contents) {
      const contentsList = Contents.map((c) => c.Key);
      keys.push(...contentsList);
    }
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
  }

  const filteredKeys = keys.filter(isJwk);

  console.log("Object keys: ", filteredKeys);
  return filteredKeys;
};

export const isJwk = (objectKey) => {
  const keyElements = objectKey.split(".");
  return keyElements.pop() === JWK_EXTENSION;
};

/**
 * Gets content of an object key.
 *
 * @function getObjectString
 * @async
 * @param {S3Client} client - An instance of the S3 client.
 * @param {string} bucket - Bucket name.
 * @param {string} key - Object key.
 * @returns {Promise<string>} Promise resolves to object string.
 */
export const getObjectString = async (client, bucket, key) => {
  console.log("Getting object string for key: ", key);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  const str = await response.Body.transformToString();
  console.log("Got object string for key: ", key);
  return str;
};

/**
 * Gets contents of a list of object keys.
 *
 * @function getObjectStrings
 * @async
 * @param {S3Client} client - An instance of the S3 client.
 * @param {string} bucket - Bucket name.
 * @param {Array} keys - Array of object keys.
 * @returns {Promise<Array<string>>} Promise resolves to array of object strings.
 */
export const getObjectStrings = async (client, bucket, keys) => {
  console.log("Getting object strings for keys: ", keys);
  const objectStrings = [];
  await Promise.allSettled(
    keys.map(async (key) => {
      const objectStr = await getObjectString(client, bucket, key);
      objectStrings.push(objectStr);
    })
  );
  console.log("Got object strings for keys: ", keys);
  return objectStrings;
};

/**
 * Exports a list of JWK public keys.
 *
 * @function exportJwks
 * @param {Array} keyStrings - Array of JWK key content strings.
 * @returns {Object} Object containing the list of JWK public keys.
 */
export const exportJwks = (keyStrings) => {
  console.log("Exporting jwks");
  const jwkArray = keyStrings.map((keyStr) => {
    const keyJson = JSON.parse(keyStr);
    const jwk = keyJson.keys[0];
    return jwk;
  });
  const jwks = { keys: jwkArray };
  console.log("Exported jwks: ", jwks);
  return jwks;
};

/**
 * Creates an api gateway response object.
 *
 * @function createResponse
 * @param {number} httpStatusCode - Http status code.
 * @param {Object|String} body - Body of http response.
 * @returns {Object} Http response object.
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
  responseObject.body = typeof body === "object" ? JSON.stringify(body) : body;
  return responseObject;
};
