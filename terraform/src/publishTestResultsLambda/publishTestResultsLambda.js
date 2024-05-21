import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import isEqual from "lodash.isequal";

const sns = new SNSClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

/*
  Lambda to publish test results to SNS topic
*/
export const handler = async (event) => {
  console.log("------event-------", JSON.stringify(event));
  const uploadedRecords = event.Records;
  console.log("Number of records uploaded: ", uploadedRecords.length);

  try {
    const resultsRecordsUpload = await processIncomingRecords(uploadedRecords);

    const filteredRecords = resultsRecordsUpload.filter(
      (record) => record.status !== "fulfilled"
    );

    if (filteredRecords.length > 0) {
      console.warn("Some Records did not update properly");
    } else {
      return `The episode records have been successfully created.`;
    }
  } catch (error) {
    console.error(`Error: Error in publish test results lambda`);
    console.error(`Error: ${error}`);
  }
};

// METHODS
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
          const uploadRecord = await sendToTopic(
            formattedOutput,
            sns
          );
          if (uploadRecord.$metadata.httpStatusCode == 200) {
            return Promise.resolve(
              `Successfully published participant ${newImage.Participant_Id.S} info to ${SNS_TOPIC_ARN} topic`
            );
          } else {
            const msg = `Error: An error occured trying to publish participant ${newImage.Participant_Id.S} info to ${SNS_TOPIC_ARN} topic`;
            console.error(msg);
            return Promise.reject(msg);
          }
        } else {
          console.warn("RECORD HAS NOT BEEN MODIFIED");
          return Promise.reject(
            `Record has not been modified`
          );
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

export const formatTestResultRecord = (record) => {
  console.log("Entered formatTestResultRecord");
  var message = {
    participant_id: record.Participant_Id.S,
    grail_id: record.Grail_Id.S,
    grail_FHIR_result_id: record.Grail_FHIR_Result_Id.S
  };

  const params = {
    Message: JSON.stringify(message),
    TopicArn: `arn:aws:sns:eu-west-2:136293001324:${ENVIRONMENT}-${SNS_TOPIC_ARN}`
  };
  console.log("Exiting formatTestResultRecord");
  return params;
};

export const sendToTopic = async (formattedOutput, sns) => {
  console.log("Entered sendToTopic");
  try {
    const command = new PublishCommand(formattedOutput);
    console.log("------1-------", JSON.stringify(command));
    const response = await sns.send(command);
    console.log("Exiting sendToTopic", JSON.stringify(response));

    return response;
  } catch (error) {
    console.error(`Error: Failed to send message to SNS Topic: ${SNS_TOPIC_ARN}`);
    console.error(`Error: ${error}`);
    throw error;
  }
};
