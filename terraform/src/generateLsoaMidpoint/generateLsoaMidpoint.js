import { S3 } from "aws-sdk";

export const s3 = new S3();
const lsoaHeader =
  "POSTCODE,POSTCODE_2,LOCAL_AUT_ORG,NHS_ENG_REGION,SUB_ICB,CANCER_REGISTRY,EASTING_1M,NORTHING_1M,LSOA_2011,MSOA_2011,CANCER_ALLIANCE,ICB,OA_2021,LSOA_2021,MSOA_2021,IMD_RANK,IMD_DECILE,LSOA_NAME,AVG_EASTING,AVG_NORTHING";

exports.handler = async (event) => {
  const bucketName = `${process.env.ENVIRONMENT}-${process.env.BUCKET_NAME}`;
  const fileName = event.fileName;

  try {
    // Read the file content from S3
    const fileContent = await readFileFromS3(bucketName, fileName);

    // Process the data
    const lsoaArray = await processData(fileContent);

    // Group the data
    const lsoaGrouped = await groupBy(lsoaArray, "LSOA_2011");

    // Convert string to CSV
    const lsoaAvgGeneratedCsv = generateCsvString(lsoaHeader, lsoaGrouped);

    // Save to s3
    writeToS3(bucketName, fileName, lsoaAvgGeneratedCsv);

    // Further processing or return the response
    return { statusCode: 200, body: JSON.stringify(lsoaArray) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: "Internal Server Error" };
  }
};

export const readFileFromS3 = async (bucket, key) => {
  const params = { Bucket: bucket, Key: key };
  const data = await s3.getObject(params).promise();
  return data.Body.toString("utf-8");
};

export const writeToS3 = async (bucket, key, data) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: data,
    ContentType: "text/csv",
  };
  await s3.putObject(params).promise();
};

export const processData = async (csvString) => {
  const dataArray = [];

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        dataArray.push(row);
      })
      .on("end", () => {
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

export const generateCsvString = (header, dataArray) => {
  return [
    header,
    ...dataArray.map((element) => Object.values(element).join(",")),
  ].join("\n");
};

export const groupBy = async (arr, prop) => {
  const map = new Map(Array.from(arr, (obj) => [obj[prop], []]));
  arr.forEach((obj) => {
    map.get(obj[prop]).push(obj);
  });

  map.forEach((x) => {
    let avgEasting = 0;
    let avgNorthing = 0;
    for (let i = 0; i < x.length; i++) {
      if (x[i].EASTING_1M && x[i].NORTHING_1M) {
        avgEasting += Math.floor(parseInt(x[i].EASTING_1M, 10) / x.length);
        avgNorthing += Math.floor(parseInt(x[i].NORTHING_1M, 10) / x.length);
      } else {
        throw "groupBy function failed: ";
      }
    }
    for (let i = 0; i < x.length; i++) {
      x[i].AVG_EASTING = String(avgEasting);
      x[i].AVG_NORTHING = avgNorthing.toLocaleString("en-GB", {
        minimumIntegerDigits: 7,
        useGrouping: false,
      });
    }
  });
  const finalArray = Array.from(map.values());
  return finalArray.flat();
};
