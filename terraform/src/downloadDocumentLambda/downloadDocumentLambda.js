import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
const ENVIRONMENT = process.env.ENVIRONMENT;

const client = new S3Client();
/*
  Lambda to get documents API by providing the documentType and fileName
*/
export const handler = async (event, context) => {
  const documentType = event.queryStringParameters.documentType; // Document Type from query parameters
  const fileName = event.queryStringParameters.fileName; // File Name from query parameters
  console.log("documentType: ", documentType);
  console.log("fileName: ", fileName);
  const bucketName = `${ENVIRONMENT}-inbound-nrds-galleritestresult-step4-success`;
  console.log("bucketName: ", bucketName);
  const key = `${fileName}.${documentType}`; // Construct the S3 key

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const data = await client.send(command);
    const documentType = key.split(".").pop(); // Assuming the document type is the file extension
    const fileName = key.split("/").pop(); // Assuming the file name is the last part of the key

    // Create a readable stream from the S3 object
    const s3Stream = data.Body;
    console.log("data.Body: ", data.Body);
    // Convert the readable stream to a base64 encoded string
    const base64data = await new Promise((resolve, reject) => {
      const chunks = [];
      s3Stream.on("data", (chunk) => chunks.push(chunk));
      s3Stream.on("error", reject);
      s3Stream.on("end", () =>
        resolve(Buffer.concat(chunks).toString("base64"))
      );
    });
    console.log("base64data: ", base64data);
    return {
      statusCode: 200,
      headers: {
        "Content-Type": data.ContentType,
        "Content-Disposition": `attachment; filename=${fileName}`,
        "Document-Type": documentType,
        "File-Name": fileName,
      },
      body: base64data,
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error fetching document:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
