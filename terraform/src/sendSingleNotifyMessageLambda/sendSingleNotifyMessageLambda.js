import jwt from 'jsonwebtoken';
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
const statusCodesToRetryOn = [408,425,429,500,501,503,504];

export const handler = async(event) => {
  try {
    const apiKey = await getSecret(process.env.API_KEY,smClient);
    const privateKey = await getSecret(process.env.PRIVATE_KEY_NAME,smClient)
    const signedJWT = generateJWT(apiKey, process.env.TOKEN_ENDPOINT_URL, process.env.PUBLIC_KEY_ID, privateKey);
    const accessToken = await getAccessToken(process.env.TOKEN_ENDPOINT_URL, signedJWT);

    await processRecords(event.Records, accessToken, dynamodbClient, sqsClient);
  } catch (error) {
    console.error('Error occurred whilst processing the batch of messages from SQS');
    console.error('Error:', error);
  }
};

/**
 * This function is used to process records that are picked up from the queue.
 * Messages are sent to NHS Notify and will have the response stored in the NotifySendMessageStatus DynamoDB table.
 * Afterwards the message will be deleted from the queue it was picked up from.
 * @async
 * @param {Array} records The array of records picked up from the SQS queue
 * @param {Object} accessToken Access token object used to send requests to NHS Notify
 * @param {Object} dynamodbClient An instance of a DynamoDB client
 * @param {Object} sqsClient An instance of an SQS client
 */
export async function processRecords(records, accessToken, dynamodbClient, sqsClient) {
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
        console.log(`Request to NHS Notify for ${messageBody.participantId} with event ${messageBody.episodeEvent} (${messageBody.routingId}) successful - MessageId: ${responseBody.id}`);
        await putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, notifySendMessageStatusTable, dynamodbClient);
        recordsSuccessfullySent++;
      } catch(error) {
        if(error.status && error.details) {
          console.error(`Error: Request to NHS Notify for participant ${messageBody.participantId} with event ${messageBody.episodeEvent} (${messageBody.routingId}) failed - Status code: ${error.status} and Details: ${error.details}`)
          await putFailedResponseIntoTable(messageBody, error.messageSent, error.numberOfAttempts.toString(), error.status.toString(), error.details, messageReferenceId,  notifySendMessageStatusTable, dynamodbClient)
          recordsFailedToSend++;
        } else {
          error.participantId = messageBody.participantId;
          throw error;
        }
      }

      await deleteMessageInQueue(messageBody,record,process.env.ENRICHED_MESSAGE_QUEUE_URL,sqsClient);
    } catch (error) {
      recordsFailedToSend++;
      console.error(`Error: Not able to process participant ${error.participantId} due to error ${error.message}`);
    }
  }
  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSend}`);
};

/**
 * Function to save details of a successful response into a DynamoDB table
 * @async
 * @param {Object} messageBody Body of message that was sent
 * @param {string} messageSentAt Timestamp of when the message was sent
 * @param {number} numberOfAttempts Number of attempts for sending the message
 * @param {Object} responseBody Body of response from NHS Notify
 * @param {string} messageReferenceId Message Reference id that was sent with the message
 * @param {string} table Table name of the where to store the successful response details
 * @param {Object} dynamodbClient An instance of a DynamoDB client
 * @throws {Error} Error related to building or putting record
 */
export async function putSuccessResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, responseBody, messageReferenceId, table, dynamodbClient) {
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

/**
 * Function to save details of a failed response into a DynamoDB table
 * @async
 * @param {Object} messageBody Body of message that was sent
 * @param {string} messageSentAt Timestamp of when the message was sent
 * @param {number} numberOfAttempts Number of attempts for sending the message
 * @param {string} statusCode Status code of last failed request
 * @param {Object} errorDetails Error details from NHS Notify
 * @param {string} messageReferenceId Message Reference id that was sent with the message
 * @param {string} table Table name of the where to store the failed response details
 * @param {Object} dynamodbClient An instance of a DynamoDB client
 * @throws {Error} Error related to building or putting record
 */
export async function putFailedResponseIntoTable(messageBody, messageSentAt, numberOfAttempts, statusCode, errorDetails, messageReferenceId, table, dynamodbClient) {
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

/**
 * Item to be put into the DynamoDB table
 * @async
 * @param {Object} item Item to be put into the table
 * @param {string} table Table name
 * @param {Object} client An instance of an S3 client
 * @returns {Object} Response returned from the S3 send command
 * @throws {Error} Error putting record in DynamoDB table
 */
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

/**
 * Generates a UUID for the message reference
 * @returns {string} UUID
 */
export async function generateMessageReference() {
  const messageReferenceId = uuidv4();
  return messageReferenceId;
}

/**
 * Send a message to NHS Notify
 * @async
 * @param {Object} messageBody Message body to be sent
 * @param {Object} token Token to be used to send the request
 * @param {string} messageReferenceId Message reference to be send with the request
 * @param {string} messagesEndpoint Endpoint to send the message to
 * @param {number} initialRetryDelay The initial delay after the first failed attempt
 * @param {number} maxRetries Max number of retries after the first failed attempt
 * @returns {Object} Response object and number of attempts to send the message
 * @throws {Error} Error sending message to NHS Notify
 */
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
          participantId,
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

/**
 * Delete message from the SQS queue
 * @async
 * @param {Object} message message to be deleted from the queue
 * @param {Object} record record to be deleted from the queue
 * @param {string} queue Url of the SQS queue
 * @param {Object} sqsClient An instance of an SQS client
 * @throws {Error} Failed to delete message error
 */
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

/**
 * Get secret from SSM
 * @async
 * @param {string} secretName Name of secret to be retrieved
 * @param {Object} client An instance of an Secrets Manager client
 * @returns Value of secret
 * @throws {Error} Failed to get secret
 */
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
    console.error(`Error: failed to retrieve secret ${secretName} - ${error}`);
    throw error;
  }
};

/**
 * Generates the JWT token
 * @param {string} apiKey Api key
 * @param {string} tokenEndpointUrl Token endpoint URL
 * @param {string} publicKeyId Public Key Id
 * @param {string} privateKey Private Key
 * @returns {Object} Signed JWT
 */
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
  return signedJWT;
};

/**
 * Get access token from token endpoint url using signed JWT
 * @async
 * @param {string} tokenEndpointUrl Endpoint of the token
 * @param {Object} signedJWT Signed JWT previously generated
 * @returns {Object} Object body of response from token endpoint
 * @throws {Error} Error getting access token
 */
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
    throw new Error(`Unable to get access token - Status code ${response.status}`);
  }
};

