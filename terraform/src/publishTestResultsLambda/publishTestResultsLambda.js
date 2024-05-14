import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const sns = new SNSClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;
const topicName = "testResultTopic";

/*
  Lambda to publish test results to SNS topic
*/
export const handler = async (event) => {
  console.log("------event-------", JSON.stringify(event));
  const uploadedRecords = event.Records;
  console.log("Number of records uploaded: ", uploadedRecords.length);

  try {
    await processIncomingRecords(uploadedRecords);
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
        console.log("*********Participant_Id***: ", record.Participant_Id);

        // generate payload
        const formattedOutput = formatTestResultRecord(record);
        // upload payload
        const uploadRecord = await sendToTopic(
          formattedOutput,
          sns
        );
        if (uploadRecord.$metadata.httpStatusCode == 200) {
          return Promise.resolve(
            `Successfully published participant ${record.Participant_Id.S} info to ${topicName} topic`
          );
        } else {
          const msg = `Error: An error occured trying to publish participant ${record.Participant_Id.S} info to ${topicName} topic`;
          console.error(msg);
          return Promise.reject(msg);
        }
      })
    );

    console.log("Exiting processIncomingRecords");
    return resultsRecordsUpload;
  } catch (error) {
    console.error(`Error: Error in processIncomingRecords`);
    throw error;
  }
};

export const formatTestResultRecord = (record) => {
  console.log("Entered formatTestResultRecord");
  const params = {
    Message: {
      participant_id: {
        S: `${record.Participant_Id.S}`,
      },
      grail_id: {
        S: `${record.Grail_Id.S}`
      },
      grail_FHIR_result_id: {
        S: `${record.Grail_FHIR_Result_Id.S}`
      }
    },
    MessageStructure: 'json',
    TopicName: `${ENVIRONMENT}-${topicName}`
  };
  console.log("Exiting formatTestResultRecord");
  return params;
};

export const sendToTopic = async (formattedOutput, sns) => {
  console.log("Entered sendToTopic");
  try {
    const command = new PublishCommand(formattedOutput);
    const response = await sns.send(command);
    console.log("Exiting sendToTopic");

    return response;
  } catch (error) {
    console.error(`Error: Failed to send message to SNS Topic: ${topicName}`);
    throw error;
  }
};