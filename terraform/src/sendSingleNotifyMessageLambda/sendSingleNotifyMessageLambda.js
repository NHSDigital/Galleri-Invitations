import jwtModule from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as qs from 'qs';
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";

const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const sqs = new SQSClient({});
const { sign } = jwtModule;

export const handler = async(event) => {
  try {
    const apiKey = await getSecret(process.env.API_KEY,smClient);
    const privateKey = await getSecret(process.env.PRIVATE_KEY_NAME,smClient)
    const signedJWT = generateJWT(apiKey, process.env.TOKEN_ENDPOINT_URL, process.env.PUBLIC_KEY_ID, privateKey);
    const accessToken = await getAccessToken(process.env.TOKEN_ENDPOINT_URL, signedJWT);
    console.log(accessToken);

    for (let record of event.Records) {
      try {
        await sendSingleMessageToNHSNotify(JSON.parse(record.body), accessToken);
        await deleteMessageInQueue(JSON.parse(record.body),record,process.env.ENRICHED_MESSAGE_QUEUE_URL,sqs);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  } catch (error) {
    console.error(error.message);
  }
};

export async function sendSingleMessageToNHSNotify(messageBody, accessToken) {


}

export async function deleteMessageInQueue(message,record,queue,sqsClient) {
  const deleteMessageCommand = new DeleteMessageCommand({
    QueueUrl: queue,
    ReceiptHandle: record.receiptHandle
  });

  try {
    await sqsClient.send(deleteMessageCommand);
    console.log(`Deleted message with id ${record.messageId} for participant Id: ${message.participantId} with episode event ${message.episodeEvent} from the raw message queue.`);
  } catch (error) {
    console.error(`Error: Failed to delete message: ${record.messageId} for participant Id: ${message.participantId} with episode event ${message.episodeEvent}`);
    throw error;
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

const generateJWT = (apiKey, tokenEndpointUrl, publicKeyId, privateKey) => {
  const expiration = Math.floor(new Date().getTime() / 1000) + (5 * 60);
  const claims = {
    "sub": apiKey,
    "iss": apiKey,
    "jti": uuidv4(),
    "aud": tokenEndpointUrl,
    "exp":  expiration,/* 5mins in the future */
  };

  const signedJWT = sign(claims, privateKey, { algorithm: "RS512", header: { kid: publicKeyId } });
  console.log("Signed jwt: ", signedJWT);
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
  if (response.status === 200) {
    return response.data;
  } else {
    return undefined;
  }
};

