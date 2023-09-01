import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { Readable } from 'stream';
import csv from 'csv-parser';

/*
  Lambda to load clinic information and pass on to GPS client.
*/
export const handler = async () => {
  const client = new DynamoDBClient({ region: "eu-west-2" })
  var params = {
    Key: {
      "ClinicId": {
        S: "0001"
      }
    },
    TableName: "PhlebotomySite"
  };
  const command = new GetItemCommand(params);
  const response = await client.send(command);

  console.log(JSON.stringify(response));
}

// dynamodb.getItem(params, function (err, data) {
//   if (err) console.log(err, err.stack); // an error occurred
//   else console.log(data);           // successful response
//   /*
//   data = {
//    Item: {
//     "AlbumTitle": {
//       S: "Songs About Life"
//      },
//     "Artist": {
//       S: "Acme Band"
//      },
//     "SongTitle": {
//       S: "Happy Day"
//      }
//    }
//   }
//   */
// });
