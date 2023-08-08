
const readCsvFromS3 = async (bucketName, key) => {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key
  });

  const response = await client.send(command);

  return response.Body.transformToString();
};

const pushCsvToS3 = async (bucketName, key, body) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
  });

  try {
    const response = await client.send(command);
    console.log('Succeeded');
    return response;
  } catch (err) {
    console.log('Failed', err);
    throw err;
  }
};
