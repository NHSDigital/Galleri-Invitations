import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import fetch from 'fetch-retry';
import nodeFetch from 'node-fetch';
import * as qs from 'qs';
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodbClient = new DynamoDBClient({ region: "eu-west-2" });
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({});
const notifySendMessageStatusTable = 'NotifySendMessageStatus';
const ENVIRONMENT = process.env.ENVIRONMENT;
const statusCodesToRetryOn = [400,408,425,429,500,501,503,504];

export const handler = async(event) => {
  try {
    const apiKey = await getSecret(process.env.API_KEY,smClient);
    const privateKey = await getSecret(process.env.PRIVATE_KEY_NAME,smClient)
    const signedJWT = generateJWT(apiKey, process.env.TOKEN_ENDPOINT_URL, process.env.PUBLIC_KEY_ID, privateKey);
    const accessToken = await getAccessToken(process.env.TOKEN_ENDPOINT_URL, signedJWT);

    await processRecords(event.Records, accessToken);
  } catch (error) {
    console.error('Error occurred whilst processing the batch of messages from SQS');
    console.error('Error:', error);
  }
};

export async function processRecords(records, accessToken) {
  const totalRecords = records.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSend = 0;

  for (let record of records) {
    try {
      const messageBody = JSON.parse(record.body);
      const messageReferenceId = await generateMessageReference();
      const messageSentAt = new Date().toISOString();
      try {
        const {responseObject, numberOfAttempts} = await sendSingleMessage(messageBody, accessToken, messageReferenceId, process.env.MESSAGES_ENDPOINT_URL, process.env.INITIAL_RETRY_DELAY, process.env.MAX_RETRIES);
        const responseBody = responseObject.data;
        console.log(`Request to NHS Notify for ${messageBody.participantId} successful  - MessageId: ${responseBody.id}`);
        await putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, notifySendMessageStatusTable);
        recordsSuccessfullySent++;
      } catch(error) {
        if(error.status && error.details) {
          console.error(`Error: Request to NHS Notify for participant ${messageBody.participantId} failed - Status code: ${error.status} and Details: ${error.details}`)
          await putFailedResponseIntoTable(messageBody, error.messageSent, error.numberOfAttempts.toString(), error.status.toString(), error.details, messageReferenceId,  notifySendMessageStatusTable)
          recordsFailedToSend++;
        } else {
          throw error;
        }
      }

      await deleteMessageInQueue(messageBody,record,process.env.ENRICHED_MESSAGE_QUEUE_URL,sqsClient);
    } catch (error) {
      recordsFailedToSend++;
      console.error('Error:', error);
    }
  }
  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSend}`);
};

export async function putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, table) {
  let item;
  const { nhsNumber, routingId, participantId, ...personalisation} = messageBody;

  try {
    item = {
      'Participant_Id': {
        S: participantId
      },
      'Message_Sent': {
        S: messageSentAt
      },
      'Routing_Plan_Id': {
        S: routingId
      },
      'Message_Reference': {
        S: messageReferenceId
      },
      'Nhs_Number': {
        S: nhsNumber
      },
      'Message_Personalisation': {
        S: JSON.stringify(personalisation)
      },
      'Message_Id': {
        S: responseBody.id
      },
      'Number_Of_Attempts': {
        N: (numberOfAttempts).toString()
      },
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error(`Error with building success record for participant ${participantId} to put into ${table}`);
  }

  const response = await putItemIntoTable(item, table, dynamodbClient);
  if (response.$metadata.httpStatusCode === 200){
    console.log(`Added successful result record for ${participantId} in ${table}`);
  } else {
    throw new Error(`Error with adding success record for participant ${participantId} in ${table}`);
  }
};

export async function putFailedResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, statusCode, errorDetails, messageReferenceId, table) {
  let item;
  const { nhsNumber, routingId, participantId, ...personalisation} = messageBody;
  try {
    item = {
      'Participant_Id': {
        S: participantId
      },
      'Message_Sent': {
        S: messageSentAt,
      },
      'Routing_Plan_Id': {
        S: routingId
      },
      'Message_Reference': {
        S: messageReferenceId,
      },
      'Nhs_Number': {
        S: nhsNumber
      },
      'Message_Personalisation': {
        S: JSON.stringify(personalisation)
      },
      'Message_Http_Status_Code': {
        S: statusCode
      },
      'Message_Error_Details': {
        S: errorDetails
      },
      'Number_Of_Attempts': {
        N: numberOfAttempts
      },
    };
  } catch (error) {
    console.error('Error:', error);
    throw new Error(`Error with building failed record for participant ${participantId} to put into ${table}`);
  }

  const response = await putItemIntoTable(item, table, dynamodbClient);
  if (response.$metadata.httpStatusCode === 200){
    console.log(`Added failed result record for ${participantId} in ${table}`);
  } else {
    throw new Error(`Error with adding failed record for participant ${participantId} in ${table}`);
  }
};

export async function putItemIntoTable(item, table, client) {
  const input = {
    TableName: `${ENVIRONMENT}-${table}`,
    Item: item,
  };

  try{
    const command = new PutItemCommand(input);
    const response = await client.send(command);
    return response;
  } catch (error) {
    console.error(`Error: Error with putting record into table ${table}`);
    throw error;
  }
}

export async function generateMessageReference() {
  const messageReferenceId = uuidv4();
  return messageReferenceId;
}

export async function sendSingleMessage(messageBody, token, messageReferenceId, messagesEndpoint, initialRetryDelay, maxRetries) {
  const { nhsNumber, routingId, participantId, ...personalisation} = messageBody;

  let numberOfAttempts = 1;
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

  const customFetch = fetch(nodeFetch);
  let messageSentAt = new Date().toISOString();

  const response = await customFetch(messagesEndpoint, {
    method: 'POST',
    retryDelay: (attempt) => initialRetryDelay * Math.pow(2, attempt),
    retryOn: (attempt, error, response) => {
      messageSentAt = new Date().toISOString();
      if (statusCodesToRetryOn.includes(response.status) && attempt < maxRetries) {
        numberOfAttempts++;
        console.error(`NHS Notify request failed for participant ${participantId} with status code ${response.status}`);
        console.log(`Retrying request for participant ${participantId} to NHS Notify, Attempt: ${attempt+1}`);
        return true;
      }
      return false;
    },
    headers: headers,
    body: JSON.stringify({ data })
  });

  if (!response.ok) {
    return response.json().then(errorDetails => {
      const error = new Error(`HTTP error! Status: ${response.status}. Details: ${JSON.stringify(errorDetails)}`);
      console.error(`Error: Failed request to NHS Notify after ${numberOfAttempts} attempt(s) for participant ${participantId}`);
      error.status = response.status;
      error.details = JSON.stringify(errorDetails);
      error.numberOfAttempts = numberOfAttempts;
      error.messageSent = messageSentAt;
      throw error;
    });
  }
  const responseObject = await response.json();

  console.log(`Sent message for participant ${participantId} to NHS Notify`);
  return {responseObject, numberOfAttempts};
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

export const generateJWT = (apiKey, tokenEndpointUrl, publicKeyId, privateKey) => {
  const expiration = Math.floor(new Date().getTime() / 1000) + (5 * 60);
  const claims = {
    "sub": apiKey,
    "iss": apiKey,
    "jti": uuidv4(),
    "aud": tokenEndpointUrl,
    "exp":  expiration,/* 5mins in the future */
  };

  const signedJWT = jwt.sign(claims, privateKey, { algorithm: "RS512", header: { kid: publicKeyId } });
  console.log("Signed jwt: ", signedJWT);
  return signedJWT;
};

export const getAccessToken = async (tokenEndpointUrl, signedJWT) => {
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

