import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';
import { Readable } from 'stream';

import * as fs from 'fs';
import path from 'path';

import {
  getObjectKeys,
  isJwk,
  getObjectString,
  getObjectStrings,
  exportJwks,
  createResponse
} from '../../gpsJwksLambda/gpsJwksLambda.js';

describe("isJwk", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("return true for jwk object key", async () => {
    expect(isJwk("cis2-int-1.json")).toEqual(true);
  });

  test("return false for other object key", async () => {
    expect(isJwk("cis2-int-1.pem.pub")).toEqual(false);
  });
});

describe('getObjectKeys', () => {
    test('should return empty array when no object found', async () => {
      const mockS3Client = mockClient(new S3Client({}));
      mockS3Client
      .on(ListObjectsV2Command)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "isTruncated": false,
        "NextContinuationToken": "token"
      });

      const objectKeys = await getObjectKeys(mockS3Client, "bucketName");
      expect(objectKeys).toEqual([]);
    });

    test('should return jwk object keys', async () => {
      const mockS3Client = mockClient(new S3Client({}));
      const key1 = "key1.json";
      const key2 = "key2.json";
      const contents = [{ "Key": key1 }, { "Key": key2 }];

      mockS3Client
      .on(ListObjectsV2Command)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "isTruncated": false,
        "NextContinuationToken": "token",
        "Contents": contents
      });

      const objectKeys = await getObjectKeys(mockS3Client, "bucketName");
      expect(objectKeys.length).toEqual(2);
      expect(objectKeys[0]).toEqual(key1);
      expect(objectKeys[1]).toEqual(key2);
    });

    test('should not return other object keys', async () => {
      const mockS3Client = mockClient(new S3Client({}));
      const key1 = "key1.json";
      const key2 = "key2.txt";
      const contents = [{ "Key": key1 }, { "Key": key2 }];

      mockS3Client
      .on(ListObjectsV2Command)
      .resolves({
        "$metadata": {
            "httpStatusCode": 200
        },
        "isTruncated": false,
        "NextContinuationToken": "token",
        "Contents": contents
      });

      const objectKeys = await getObjectKeys(mockS3Client, "bucketName");
      expect(objectKeys.length).toEqual(1);
      expect(objectKeys[0]).toEqual(key1);
    });
});

describe('getObjectString', () => {
  test('should return object content string', async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const jwk = {
      "keys": [
        {
          "kty": "RSA",
          "n": "n",
          "e": "AQAB",
          "alg": "RS512",
          "kid": "kid",
          "use": "sig"
        }
      ]
    }
    const contentString = JSON.stringify(jwk);
    const stringStream = Readable.from(contentString);
    const stream = sdkStreamMixin(stringStream);

    mockS3Client
    .on(GetObjectCommand)
    .resolves({
      "$metadata": {
          "httpStatusCode": 200
      },
      "Body": stream
    });

    const objectString = await getObjectString(mockS3Client, "bucketName", "key");
    expect(objectString).toEqual(contentString);
  });
});

describe('getObjectStrings', () => {
  test('should return object content string', async () => {
    const mockS3Client = mockClient(new S3Client({}));
    const jwk = {
      "keys": [
        {
          "kty": "RSA",
          "n": "n",
          "e": "AQAB",
          "alg": "RS512",
          "kid": "kid",
          "use": "sig"
        }
      ]
    }
    const contentString = JSON.stringify(jwk);
    const stringStream = Readable.from(contentString);
    const stream = sdkStreamMixin(stringStream);

    mockS3Client
    .on(GetObjectCommand)
    .resolves({
      "$metadata": {
          "httpStatusCode": 200
      },
      "Body": stream
    });

    const objectStrings = await getObjectStrings(mockS3Client, "bucketName", ["key1"]);
    expect(objectStrings.length).toEqual(1);
    expect(objectStrings[0]).toEqual(contentString);
  });
});

describe('exportJwks', () => {
  test('should return jwks from given list of jwk', async () => {
    const key1 = {
      "kty": "RSA",
      "n": "n",
      "e": "AQAB",
      "alg": "RS512",
      "kid": "kid1",
      "use": "sig"
    }
    const key2 = {
      "kty": "RSA",
      "n": "n",
      "e": "AQAB",
      "alg": "RS512",
      "kid": "kid2",
      "use": "sig"
    }
    const jwk1 = {
      "keys": [key1]
    }
    const jwk2 = {
      "keys": [key2]
    }
    const jwkStrings = [JSON.stringify(jwk1), JSON.stringify(jwk2)];

    const jwks = exportJwks(jwkStrings);
    expect(jwks.keys.length).toEqual(jwkStrings.length);
    expect(jwks.keys[0]).toEqual(jwk1.keys[0]);
    expect(jwks.keys[1]).toEqual(jwk2.keys[0]);
  });
});

describe('createResponse', () => {
  test('return response for object body', async () => {
    const httpStatusCode = 200;
    const key = {
      "kty": "RSA",
      "n": "n",
      "e": "AQAB",
      "alg": "RS512",
      "kid": "kid1",
      "use": "sig"
    }
    const jwk = {
      "keys": [key]
    }
    const headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }

    const body = {}
    const response = createResponse(httpStatusCode, jwk);
    expect(response.statusCode).toEqual(httpStatusCode);
    expect(response.isBase64Encoded).toEqual(true);
    expect(response.body).toEqual(JSON.stringify(jwk));
    expect(response.headers).toEqual(headers);
  });

  test('return response for string body', async () => {
    const httpStatusCode = 200;
    const strBody = "Body string"
    const headers = {
      "Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "OPTIONS,GET",
    }

    const body = {}
    const response = createResponse(httpStatusCode, strBody);
    expect(response.statusCode).toEqual(httpStatusCode);
    expect(response.isBase64Encoded).toEqual(true);
    expect(response.body).toEqual(strBody);
    expect(response.headers).toEqual(headers);
  });
});


