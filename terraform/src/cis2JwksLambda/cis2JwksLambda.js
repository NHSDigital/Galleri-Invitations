import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import { createPublicKey } from "crypto";

const client = new S3Client({});

export const handler = async () => {
  try {
    console.log("Getting CIS2 public key jwks");
    const bucket = process.env.PUBLIC_KEYS_BUCKET;
    const publicKeyIds = await getObjectKeys(client, bucket);
    const publicKeyStrings = await getObjectStrings(client, bucket, publicKeyIds);
    const publicKeyJwks = exportJwks(publicKeyIds, publicKeyStrings);

    const responseObject = {};
    responseObject.statusCode = 200;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.isBase64Encoded = true;
    responseObject.body = JSON.stringify(publicKeyJwks);

    console.log(`Returning CIS2 public key jwks: ${responseObject.body}`);
    return responseObject;
  } catch (err) {
    console.error(`Error getting CIS2 public key jwks: ${err.message}`);
    const responseObject = {};
    responseObject.statusCode = 500;
    responseObject.headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    };
    responseObject.isBase64Encoded = true;
    responseObject.body = JSON.stringify(err.message);
    return responseObject;
  }
};

export const getObjectKeys = async (client, bucket) => {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
  });

  let isTruncated = true;
  let keys = [];

  while (isTruncated) {
    const { Contents, IsTruncated, NextContinuationToken } =
      await client.send(command);
    const contentsList = Contents.map((c) => c.Key);
    keys.push(...contentsList);
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
  }
  return keys;
};

export const getObjectString = async (client, bucket, key) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  const str = await response.Body.transformToString();
  return str;
};

export const getObjectStrings = async (client, bucket, keys) => {
  const objectStrings = [];
  await Promise.allSettled(keys.map(async (key) => {
    const objectStr = await getObjectString(client, bucket, key);
    objectStrings.push(objectStr);
  }));
  return objectStrings;
};

export const exportJwks = (keyIds, keyStrings) => {
  const jwks = keyStrings.map((keyStr, index) => {
    const publicKey = createPublicKey(keyStr);
    const jwk = publicKey.export({ format: "jwk" });
    jwk.alg = "RS512";
    jwk.kid = keyIds[index].split(".")[0];
    jwk.use = "sig";
    return jwk;
  });
  return { "keys": jwks };
};
