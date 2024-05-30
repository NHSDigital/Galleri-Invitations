import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
const ENVIRONMENT = process.env.ENVIRONMENT;
const s3Client = new S3Client({});
/*
  Lambda to get documents API by providing the participant ID
*/
export const handler = async (event, context) => {
  let participantId = event.queryStringParameters.participantId;
  console.log("Participant ID: ", participantId);
  const bucketName = `${ENVIRONMENT}-inbound-nrds-galleritestresult-step4-success`;
  console.log("bucketName: ", bucketName);
  try {
    const listParams = {
      Bucket: bucketName,
      Prefix: participantId,
    };

    const response = await s3Client.send(new ListObjectsV2Command(listParams));
    const documents = response.Contents;
    console.log("response: ", response);
    if (!documents || documents.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "No documents found" }),
      };
    }

    const documentList = documents
      .filter((doc) => !doc.Key.includes(`fhir`)) // Exclude documents with fhir
      .map((doc) => {
        const key = doc.Key;
        const documentType = key.split(".").pop(); // Assuming the document type is the file extension
        return {
          Name: key,
          Type: documentType,
        };
      });
    return {
      statusCode: 200,
      body: JSON.stringify(documentList),
    };
  } catch (error) {
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error making HTTP request",
        error: `Error: ${error.message}`,
      }),
    };
  }
};
