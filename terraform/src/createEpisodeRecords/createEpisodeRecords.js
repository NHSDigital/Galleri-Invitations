import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { generateEpisodeID, generateParticipantID} from "../helper/generateParticipantId"

const client = new DynamoDBClient({ region: "eu-west-2" });
const ENVIRONMENT = process.env.ENVIRONMENT;

/*
  Lambda to get participants in LSOA from the list of available LSOAs
*/

export const handler = async (event) => {
  // gets record
  const changedRecords = event.Records
  const episodeRecordsUpload = []
  const chunkSize = 10

  const responseArray = await Promise.allSettled(
    changedRecords.map(async (record, index) => {
    //check if identified_to_be_invited has been changed FROM false to true
    if (record.OldImage.identified_to_be_invited === false && record.NewImage.identified_to_be_invited) {
      const episodeRecord = createEpisodeRecord(record.NewImage)
      episodeRecordsUpload.push(episodeRecord)
    }

    if (index % chunkSize === 0){
      const lowerBound = index - chunkSize
      responseArray.push(batchWriteDynamo(client, table, episodeRecordsUpload, chunkSize, lowerBound))
    }

  }));
  // compare
  // BATCH write record to Episode
  console.log(`DynamoDB Record: ${JSON.stringify(event.Records[0].dynamodb)}`);

  // DynamoDB Record:
{
    "ApproximateCreationDateTime": 1701985094,
    "Keys": {
        "LsoaCode": {
            "S": "E01032725"
        },
        "PersonId": {
            "S": "9000180910"
        }
    },
    "NewImage": {
        "primary_care_provider": {
            "S": "J00011"
        },
        "date_of_birth": {
            "S": "1973-10-02"
        },
        "interpreter_required": {
            "S": "FALSE"
        },
        "first_given_name": {
            "S": "Kali"
        },
        "sensitivity_indicator_flag": {
            "S": "NULL"
        },
        "telephone_number_mobile": {
            "S": "NULL"
        },
        "identified_to_be_invited": {
            "BOOL": true
        },
        "gender_code": {
            "S": "2"
        },
        "removal_reason": {
            "S": "NULL"
        },
        "name_prefix": {
            "S": "Mrs"
        },
        "date_of_death": {
            "S": "NULL"
        },
        "superseded_by_subject_id": {
            "S": "NULL"
        },
        "Invited": {
            "S": "true"
        },
        "address_line_1": {
            "S": "64"
        },
        "address_line_3": {
            "S": "OXFORD"
        },
        "address_line_2": {
            "S": "HIGHBURY PLACE"
        },
        "address_line_5": {
            "S": "XXX - TEST DATA - XXX"
        },
        "email_address_home": {
            "S": "NULL"
        },
        "address_line_4": {
            "S": "OXFORDSHIRE"
        },
        "preferred_language": {
            "S": "NULL"
        },
        "LsoaCode": {
            "S": "E01032725"
        },
        "removal_date": {
            "S": "NULL"
        },
        "other_given_names": {
            "S": "NULL"
        },
        "postcode": {
            "S": "RG12 8AA"
        },
        "PersonId": {
            "S": "9000180910"
        },
        "telephone_number_home": {
            "S": "NULL"
        },
        "family_name": {
            "S": "Friedman"
        }
    },
    "OldImage": {
        "primary_care_provider": {
            "S": "J00011"
        },
        "date_of_birth": {
            "S": "1973-10-02"
        },
        "interpreter_required": {
            "S": "FALSE"
        },
        "first_given_name": {
            "S": "Kali"
        },
        "sensitivity_indicator_flag": {
            "S": "NULL"
        },
        "telephone_number_mobile": {
            "S": "NULL"
        },
        "identified_to_be_invited": {
            "BOOL": false
        },
        "gender_code": {
            "S": "2"
        },
        "removal_reason": {
            "S": "NULL"
        },
        "name_prefix": {
            "S": "Mrs"
        },
        "date_of_death": {
            "S": "NULL"
        },
        "superseded_by_subject_id": {
            "S": "NULL"
        },
        "Invited": {
            "S": "true"
        },
        "address_line_1": {
            "S": "64"
        },
        "address_line_3": {
            "S": "OXFORD"
        },
        "address_line_2": {
            "S": "HIGHBURY PLACE"
        },
        "address_line_5": {
            "S": "XXX - TEST DATA - XXX"
        },
        "email_address_home": {
            "S": "NULL"
        },
        "address_line_4": {
            "S": "OXFORDSHIRE"
        },
        "preferred_language": {
            "S": "NULL"
        },
        "LsoaCode": {
            "S": "E01032725"
        },
        "removal_date": {
            "S": "NULL"
        },
        "other_given_names": {
            "S": "NULL"
        },
        "postcode": {
            "S": "RG12 8AA"
        },
        "PersonId": {
            "S": "9000180910"
        },
        "telephone_number_home": {
            "S": "NULL"
        },
        "family_name": {
            "S": "Friedman"
        }
    },
    "SequenceNumber": "40400900000000032015554746",
    "SizeBytes": 1189,
    "StreamViewType": "NEW_AND_OLD_IMAGES"
}
};

// METHODS
async function batchWriteDynamo(client, table, episodeRecordsUpload, chunkSize, lowerBound){
  // split out array
  const uploadBatch = episodeRecordsUpload.slice(lowerBound, lowerBound + chunkSize)
  //batch write to dynamodb

  return
}

function createEpisodeRecord(record, table){
  const episodeId = generateEpisodeID(record)
  const participantId = generateParticipantID(record)
  //format dynamodb json for record
  return
}
