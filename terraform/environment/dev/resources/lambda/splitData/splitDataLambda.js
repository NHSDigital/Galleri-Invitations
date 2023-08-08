import { fs } from 'fs'
import { path } from 'path'
import { readline} from 'readline'
import { readCsvFromS3 } from './../utils/s3Helper.js'

const client = new S3Client({});


// function splitFile(inputFilePath, outputDirectory, chunkSize) {
//   const inputStream = fs.createReadStream(inputFilePath, 'utf8');
//   const rl = readline.createInterface({
//     input: inputStream,
//     output: process.stdout,
//     terminal: false
//   });

//   let currentChunk = 1;
//   let currentFile = path.join(outputDirectory, `chunk_${currentChunk}.csv`);
//   let currentFileSize = 0;
//   let currentWriteStream = fs.createWriteStream(currentFile, { flags: 'a' });
//   let lineCount = 0

//   rl.on('line', (line) => {
//     lineCount++
//     if (currentFileSize + line.length > chunkSize) {
//       currentChunk++;
//       currentFile = path.join(outputDirectory, `chunk_${currentChunk}.csv`);
//       currentFileSize = 0;
//       currentWriteStream.end();
//       currentWriteStream = fs.createWriteStream(currentFile, { flags: 'a' });
//     }

//     currentWriteStream.write(line + '\n', 'utf8');
//     currentFileSize += line.length + 1;
//   });

//   rl.on('close', () => {
//     currentWriteStream.end();
//     console.log('File splitting complete.');
//   });
// }

const splitFile = (csvString) => {
  // count 1,000,000 lines
  // store in variable
  // repeat
  const lineLimit = 1000000
  const dataArray = [];
  const aux = []
  let row_counter = 0;
  let participating_counter = 0;

  return new Promise((resolve, reject) => {
    Readable.from(csvString)
      .pipe(csv())
      .on("data", (row) => {
        if (row_counter < lineLimit) {
          row_counter++;
          aux.push(row)
        } else {
          dataArray.push(aux)
          aux = []
          row_counter = 0
        }
      })
      .on("end", () => {
        console.log("CSV parsing finished, \nRow count =", row_counter, "\nNumber of participating items =", participating_counter);
        resolve(dataArray);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}


export const handler = async () => {
  // read the gridall data from s3
  // split it into 1,000,000 line chunks
  // upload chunk to s3

  // const bucketName = "galleri-ons-data";

  // const inputFile = '/Users/zainmalik/Downloads/gridall (4)/gridall_31_07_2023.csv';
  // const outputDirectory = './chunk_data';
  // const chunkSize = 1024 * 1024 * 100 * 5; // 500Mb chunk size

  // splitFile(inputFile, outputDirectory, chunkSize);

  const bucketName = "galleri-ons-data";

  const key = "gridall/gridall_31_07_2023_with_header.csv"
  const completeGridallCsvString = await readCsvFromS3(bucketName, gridallKey);
  const numberOfFiles = await splitFile(completeGridallCsvString)

};
