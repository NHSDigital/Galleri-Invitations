import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

//Push string from MESH to S3
export const pushCsvToS3 = async (bucketName, key, body, client) => {
  try {
    const response = await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
      })
    );

    console.log(`Successfully pushed to ${bucketName}/${key}`);
    return response;
  } catch (err) {
    console.log("Failed: ", err);
    throw err;
  }
};

//Return 'Secret value' from secrets manager by passing in 'Secret name'
export const getSecret = async (secretName, client) => {
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log("Failed: ", error);
    throw error;
  }
}

//generator function yields chunkSegment when desired size is reached + header
export const chunking = function* (itr, size, header) {
  let chunkSegment = [header];
  let tempStr = header;
  for (const val of itr) {
    tempStr += "\n";
    tempStr += val;
    chunkSegment.push(val);
    if (chunkSegment.length === size) {
      yield tempStr;
      chunkSegment = [header];
      tempStr = header;
    }
  }
  if (chunkSegment.length) yield tempStr;
};

//Allows upload of string from chunks to be uploaded to S3
export async function multipleUpload(chunk, client, environment) {
  let count = 0;
  return Promise.all(
    chunk.map(async (x) => {
      count++;
      let dateTime = new Date(Date.now()).toISOString();
      let filename = `mesh_chunk_data_${count}_${dateTime}`;
      let response = await (pushCsvToS3(
        `${environment}-galleri-caas-data`,
        `${filename}.csv`,
        x,
        client
      ));
      dateTime = new Date(Date.now()).toISOString();
      filename = `mesh_chunk_data_${count}_${dateTime}`;
      if (response.$metadata.httpStatusCode !== 200) {
        console.error("Error uploading item ");
      }
      return response;
    }))
}
