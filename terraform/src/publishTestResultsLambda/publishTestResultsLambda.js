import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import isEqual from "lodash.isequal";

const sns = new SNSClient({ region: "eu-west-2" });
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

/**
 * AWS Lambda handler to publish test results to SNS topic.
 *
 * @async
 * @function handler
 * @param {Object} event - The event triggering the Lambda.
 * @returns {Promise<string|void>} - A promise that resolves to a success message or nothing if there are errors.
 */
export const handler = async (event) => {
  const uploadedRecords = event.Records;
  console.log("Number of records uploaded: ", uploadedRecords.length);

  try {
    const resultsRecordsUpload = await processIncomingRecords(uploadedRecords);

    const filteredRecords = resultsRecordsUpload.filter(
      (record) => record.status !== "fulfilled"
    );

    if (filteredRecords.length > 0) {
      console.warn("Some records did not publish properly");
    } else {
      return `The test result records have been successfully published.`;
    }
  } catch (error) {
    console.error(`Error: Error in publish test results lambda`);
    console.error(`Error: ${error}`);
  }
};

/**
 * Processes incoming records by comparing old and new images, formatting, and sending them to SNS topic.
 *
 * @async
 * @function processIncomingRecords
 * @param {Array<Object>} uploadedRecordsArr - Array of uploaded records.
 * @returns {Promise<Array<Object>>} - A promise that resolves to an array of results from publishing records.
 * @throws {Error} - If there is an error processing the records.
 */
export const processIncomingRecords = async (uploadedRecordsArr) => {
  console.log("Entered processIncomingRecords");
  try {
    const resultsRecordsUpload = await Promise.allSettled(
      uploadedRecordsArr.map(async (record) => {
        console.log("Entered resultsRecordsUpload");

        const oldImage = record.dynamodb?.OldImage;
        const newImage = record.dynamodb.NewImage;
        console.log("*********Participant_Id***: ", newImage.Participant_Id);

        if (!isEqual(oldImage, newImage)) {
          // generate payload
          const formattedOutput = formatTestResultRecord(newImage);
          // upload payload
          const uploadRecord = await sendToTopic(formattedOutput, sns);
          if (uploadRecord.$metadata.httpStatusCode == 200) {
            return Promise.resolve(
              `Successfully published participant ${newImage.Participant_Id.S} info to topic`
            );
          } else {
            const msg = `Error: An error occured trying to publish participant ${newImage.Participant_Id.S} info to topic`;
            console.error(msg);
            return Promise.reject(msg);
          }
        } else {
          console.warn("RECORD HAS NOT BEEN MODIFIED");
          return Promise.reject(`Record has not been modified`);
        }
      })
    );

    console.log(JSON.stringify(resultsRecordsUpload));
    console.log("Exiting processIncomingRecords");
    return resultsRecordsUpload;
  } catch (error) {
    console.error(`Error: Error in processIncomingRecords`);
    console.error(`Error: ${error}`);
    throw error;
  }
};

/**
 * Formats a test result record into a payload for SNS.
 *
 * @function formatTestResultRecord
 * @param {Object} record - The test result record to format.
 * @returns {Object} - The formatted payload for SNS.
 */
export const formatTestResultRecord = (record) => {
  console.log("Entered formatTestResultRecord");
  var message = {
    participant_id: record.Participant_Id.S,
    grail_id: record.Grail_Id.S,
    grail_FHIR_result_id: record.Grail_FHIR_Result_Id.S,
  };

  const params = {
    Message: JSON.stringify(message),
    TopicArn: `${SNS_TOPIC_ARN}`,
  };
  console.log("Exiting formatTestResultRecord");
  return params;
};

/**
 * Sends a formatted message to the SNS topic.
 *
 * @async
 * @function sendToTopic
 * @param {Object} formattedOutput - The formatted payload for SNS.
 * @param {SNSClient} sns - The SNS client.
 * @returns {Promise<Object>} - A promise that resolves to the response from SNS.
 * @throws {Error} - If there is an error sending the message to SNS.
 */
export const sendToTopic = async (formattedOutput, sns) => {
  console.log("Entered sendToTopic");
  try {
    const command = new PublishCommand(formattedOutput);
    const response = await sns.send(command);
    console.log("Exiting sendToTopic", JSON.stringify(response));

    return response;
  } catch (error) {
    console.error(`Error: Failed to send message to SNS Topic`);
    console.error(`Error: ${error}`);
    throw error;
  }
};
