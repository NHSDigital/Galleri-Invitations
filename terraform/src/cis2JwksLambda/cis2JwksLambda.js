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
    console.error(`Error getting CIS2 public key jwks: ${err}`);
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
      console.log("Bucket contents list: ", contentsList);
      keys.push(...contentsList);
    }
    isTruncated = IsTruncated;
    command.input.ContinuationToken = NextContinuationToken;
  }
  console.log("Object keys: ", keys);
  return keys;
};

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

export const getObjectStrings = async (client, bucket, keys) => {
  console.log("Getting object strings for keys: ", keys);
  const objectStrings = [];
  await Promise.allSettled(keys.map(async (key) => {
    const objectStr = await getObjectString(client, bucket, key);
    objectStrings.push(objectStr);
  }));
  console.log("Got object strings for keys: ", keys);
  return objectStrings;
};

export const exportJwks = (keyIds, keyStrings) => {
  console.log("Exporting jwks");
  const jwks = keyStrings.map((keyStr, index) => {
    const publicKey = createPublicKey(keyStr);
    const jwk = publicKey.export({ format: "jwk" });
    jwk.alg = "RS512";
    jwk.kid = keyIds[index].split(".")[0];
    jwk.use = "sig";
    return jwk;
  });
  console.log("Exported jwks");
  return { "keys": jwks };
};
