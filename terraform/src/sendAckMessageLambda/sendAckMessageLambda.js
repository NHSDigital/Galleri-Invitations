// import { getSecret, pushToS3 } from "./helper.js"
import { handShake, loadConfig, sendMessage } from "nhs-mesh-client";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { v4 as uuidv4 } from 'uuid';
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";

//VARIABLES
const smClient = new SecretsManagerClient({ region: "eu-west-2" });
const sqsClient = new SQSClient({});
const WORKFLOW_ID = process.env.WORKFLOW_ID;
const NRDS_MESH_RECEIVER_MAILBOX_ID = process.env.NRDS_MESH_RECEIVER_MAILBOX_ID;
const MESH_SENDER_MAILBOX_ID = process.env.MESH_SENDER_MAILBOX_ID;
const MESH_SHARED_KEY = process.env.MESH_SHARED_KEY;
const MESH_SENDER_MAILBOX_PASSWORD = process.env.MESH_SENDER_MAILBOX_PASSWORD;
const KEY_PREFIX = "ack_";
const TEST_RESULT_ACK_QUEUE_URL = process.env.TEST_RESULT_ACK_QUEUE_URL;


//HANDLER
export const handler = async (event) => {

  try {
    await processRecords(event.Records, sqsClient);
  }
  catch (error) {
    console.error('Error: Failed to process the batch of messages from SQS');
    console.error('Error:', error);
  };
};

//FUNCTIONS
export async function processRecords(records, sqsClient) {
  const totalRecords = records.length;
  let recordsSuccessfullySent = 0;
  let recordsFailedToSend = 0;

  // retrieve secrets into lambda, certificates required to connect to MESH
  const MESH_SENDER_CERT = await readSecret(
    getSecret,
    "MESH_SENDER_CERT",
    smClient
  );
  const MESH_SENDER_KEY = await readSecret(
    getSecret,
    "MESH_SENDER_KEY",
    smClient
  );
  const MESH_RECEIVER_CERT = await readSecret(
    getSecret,
    "MESH_RECEIVER_CERT",
    smClient
  );
  const MESH_RECEIVER_KEY = await readSecret(
    getSecret,
    "MESH_RECEIVER_KEY",
    smClient
  );
  const CONFIG = await loadConfig({
    url: "https://msg.intspineservices.nhs.uk", //can leave as non-secret
    sharedKey: MESH_SHARED_KEY,
    sandbox: "false",
    senderCert: MESH_SENDER_CERT,
    senderKey: MESH_SENDER_KEY,
    senderMailboxID: MESH_SENDER_MAILBOX_ID,
    senderMailboxPassword: MESH_SENDER_MAILBOX_PASSWORD,
    receiverCert: MESH_RECEIVER_CERT,
    receiverKey: MESH_RECEIVER_KEY,
    receiverMailboxID: NRDS_MESH_RECEIVER_MAILBOX_ID,
  });

  for (let record of records) {
    try {
      const messageBody = JSON.parse(record.body);
      const {grail_fhir_result_id, ack_code} = messageBody;

      console.log(`Processing acknowledgment for result id ${grail_fhir_result_id} with ack code ${ack_code}`);

      const timestamp = new Date(Date.now()).toISOString();
      const messageReferenceId = uuidv4();

      const msg = await buildMessage(MESH_SENDER_MAILBOX_ID, NRDS_MESH_RECEIVER_MAILBOX_ID, grail_fhir_result_id, ack_code, messageReferenceId);

      await sendMessageToMesh(
        CONFIG,
        msg,
        `${KEY_PREFIX}${grail_fhir_result_id}_${timestamp}.json`,
        handShake,
        sendMessage
      );

      await deleteMessageInQueue(grail_fhir_result_id, ack_code, record, TEST_RESULT_ACK_QUEUE_URL, sqsClient);

    } catch (error) {
      recordsFailedToSend++;
      console.error(`Error: Not able to process record due to error ${error.message}`);
    };
  }

  console.log(`Total records in the batch: ${totalRecords} - Records successfully processed/sent: ${recordsSuccessfullySent} - Records failed to send: ${recordsFailedToSend}`);
};

//Send Message based on the MailBox ID from the config
export async function sendMessageToMesh(
  config,
  msg,
  filename,
  performHandshake,
  dispatchMessage
) {
  console.log(`Sending message to N-RDS Mailbox`);
  console.log(`Message to be sent: ${JSON.stringify(msg)}`);
  try {
    let healthCheck = await performHandshake({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      agent: config.senderAgent,
    });

    if (healthCheck.status != 200) {
      throw new Error(`Health Check Failed: ${healthCheck}`);
    }

    let message = await dispatchMessage({
      url: config.url,
      mailboxID: config.senderMailboxID,
      mailboxPassword: config.senderMailboxPassword,
      sharedKey: config.sharedKey,
      message: msg,
      mailboxTarget: config.receiverMailboxID,
      agent: config.senderAgent,
      workFlowId: WORKFLOW_ID,
      fileName: filename,
    });

    if (message.status != 202) {
      throw new Error(
        `Create Message Failed for ${filename}: ${message.status}`
      );
    } else {
      console.log(`Successfully sent ${filename} to N-RDS mailbox`);
      return message.status;
    }
  } catch (error) {
    throw error;
  }
}

//Return 'Secret value' from secrets manager by passing in 'Secret name'
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
    console.error(`Error: Failed to get secret, ${error}`);
    throw error;
  }
};

export async function readSecret(fetchSecret, secretName, client) {
  return Buffer.from(await fetchSecret(secretName, client), "base64").toString(
    "utf8"
  );
}

export async function buildMessage(sourceEndpoint, destinationEndpoint, result_id, ack_code, messageReferenceId) {
  const message = {
      resourceType: "Bundle",
      id: messageReferenceId,
      type: "message",
      entry:  [
          {
              fullUrl: "https://fhir.hl7.org.uk/StructureDefinition/UKCore-MessageHeader",
              resource: {
                  resourceType: "MessageHeader",
                  eventCoding: {
                      system: "https://fhir.nhs.uk/CodeSystem/message-event",
                      code: "notification",
                      display: "Event Notification"
                  },
                  destination:  [
                      {
                          name: "GRAIL BIO UK LTD",
                          endpoint: destinationEndpoint
                      }
                  ],
                  source: {
                      endpoint: sourceEndpoint
                  },
                  response: {
                      identifier: result_id,
                      code: ack_code
                  }
              }
          }
      ]
  };

  return message;
}

export async function deleteMessageInQueue(result_id, ack_code, record, queue, sqsClient) {
  const deleteMessageCommand = new DeleteMessageCommand({
    QueueUrl: queue,
    ReceiptHandle: record.receiptHandle
  });

  try {
    await sqsClient.send(deleteMessageCommand);
    console.log(`Deleted message for result id ${result_id} with ack code ${ack_code} from the test result ack queue.`);
  } catch (error) {
    console.error(`Error: Failed to delete message: result id ${result_id} with ack code ${ack_code}`);
    throw error;
  }
}
//END OF FUNCTIONS
