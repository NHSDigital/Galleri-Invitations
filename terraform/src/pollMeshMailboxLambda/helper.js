import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

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
        SecretId: secretName,
      })
    );
    console.log(`Retrieved value successfully ${secretName}`);
    return response.SecretString;
  } catch (error) {
    console.log("Failed: ", error);
    throw error;
  }
};

//generator function yields chunkSegment when desired size is reached + header
export const chunking = function* (itr, size, header) {
  let chunkSegment = [header];
  let generatedString = header;
  for (const val of itr) {
    generatedString += "\n";
    generatedString += val;
    chunkSegment.push(val);
    if (chunkSegment.length === size) {
      yield generatedString;
      chunkSegment = [header];
      generatedString = header;
    }
  }
  if (chunkSegment.length) yield generatedString;
};

//Allows upload of string from chunks to be uploaded to S3
export async function multipleUpload(chunk, client, environment) {
  const dateTime = new Date(Date.now()).toISOString();
  return Promise.all(
    chunk.map(async (x, index) => {
      const filename = `mesh_chunk_data_${index}_${dateTime}`;
      let response = await pushCsvToS3(
        `${environment}-galleri-caas-data`,
        `${filename}.csv`,
        x,
        client
      );
      if (response.$metadata.httpStatusCode !== 200) {
        console.error("Error uploading item ");
      }
      return response;
    })
  );
}

//For loading data to MESH (testing)
async function sendMsg(msg) {
  try {
    let messageChunk = await sendMessageChunks({
      url: CONFIG.url,
      mailboxID: CONFIG.senderMailboxID,
      mailboxPassword: CONFIG.senderMailboxPassword,
      sharedKey: CONFIG.sharedKey,
      messageFile: msg,
      mailboxTarget: CONFIG.senderMailboxID,
      agent: CONFIG.senderAgent,
    });

    console.log(messageChunk.data);
  } catch (error) {
    console.error("Error occurred:", error);
  }
}
