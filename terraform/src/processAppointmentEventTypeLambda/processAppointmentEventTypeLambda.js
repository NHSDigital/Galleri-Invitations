import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client();
const ENVIRONMENT = process.env.ENVIRONMENT;

export const handler = async (event) => {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Triggered by object ${key} in bucket ${bucket}`);
  try {
    const eventType = await extractStringFromFilepath(key);
    switch (eventType) {
      case "update":
        console.log(`This was a ${eventType}`);
        break;
      case "no_show":
        console.log(`This was a ${eventType}`);
        break;
      case "aborted":
        console.log(`This was a ${eventType}`);
        break;
      case null:
        console.log(`This was a ${eventType}`);
        break;
    }
  } catch (error) {
    const message = `Error processing object ${key} in bucket ${bucket}: ${error}`;
    console.error(message);
    throw new Error(message);
  }
};

//METHODS
export const extractStringFromFilepath = async (filepath) => {
  const regex = /valid_records-([^-]+)-([^.]+)\.json/;
  const match = filepath.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};
