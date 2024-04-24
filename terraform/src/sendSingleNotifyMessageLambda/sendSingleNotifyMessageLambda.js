import jwtModule from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fetch from 'node-fetch';
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

    for (let record of event.Records) {
      try {
        const messageBody = JSON.parse(record.body);

        try {
          const response = await sendSingleMessage(messageBody, accessToken, process.env.MESSAGES_ENDPOINT_URL);
          console.log(`NOTIFY request success - MessageId: ${response.data.id}`);
        } catch(error) {
          console.error(`NOTIFY request failed - Status: ${error.status} and Details: ${error.details}`)
        }
        await
        await deleteMessageInQueue(messageBody,record,process.env.ENRICHED_MESSAGE_QUEUE_URL,sqs);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
};

export async function sendSingleMessage(messageBody, token, messagesEndpoint) {
  const messageReferenceId = uuidv4();
  // Extract nhsNumber and routingId, the rest of the fields will go into personalisation
  const { nhsNumber, routingId, participantId, ...personalisation} = messageBody;

  console.log(token);

  if (nhsNumber === undefined) {
    throw new Error("NHS Number is undefined");
  };
  if (routingId === undefined) {
    throw new Error("Routing Id is undefined");
  }

  const data = {
      'type': 'Message',
      'attributes': {
        'routingPlanId': routingId,
        'messageReference': messageReferenceId,
        'recipient': {
          'nhsNumber': nhsNumber
        },
        'personalisation': {
          'participant_id': participantId,
          ...personalisation
        }
      }
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token['access_token']}`,
  };

  const response = await fetch(messagesEndpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ data })
  });

  if (!response.ok) {
    return response.json().then(errorDetails => {
      const error = new Error(`HTTP error! Status: ${response.status}. Details: ${JSON.stringify(errorDetails)}`);
      error.status = response.status;
      error.details = JSON.stringify(errorDetails);
      throw error;
    });
  }
  const responseObject = await response.json();

  console.log(`Sent message for participant ${participantId} to NHS Notify`);
  return responseObject;
};

export async function deleteMessageInQueue(message,record,queue,sqsClient) {
  const deleteMessageCommand = new DeleteMessageCommand({
    QueueUrl: queue,
    ReceiptHandle: record.receiptHandle
  });

  try {
    await sqsClient.send(deleteMessageCommand);
    console.log(`Deleted message with id ${record.messageId} for participant Id: ${message.participantId} with episode event ${message.episodeEvent} from the enriched message queue.`);
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

