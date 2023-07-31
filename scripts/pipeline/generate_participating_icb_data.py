import csv
import json
import os

# format
# {
#     "PutRequest": {
#     "Item": {
#         "NhsNumber": {
#         "N": "999999999"
#         },
#         "GivenName": {
#         "S": "Zain"
#         },
#         "TelephoneNumberMobile": {
#         "S": "0800800800A"
#         },
#         "EmailAddressHome": {
#         "S": "no_email@email.com"
#         }
#     }
#     }
# }

def generate_participating_icb_json(file_path, table_name):
    with open(file_path, 'r', encoding='utf-8-sig') as file:
        csvreader = csv.reader(file)
        dynamodb_json_object = format_dynamodb_json(csvreader)

    json_file = { table_name : dynamodb_json_object}
    json_object = json.dumps(json_file, indent=4)

    # create output json file
    output_json_path = "/test-data/participating_icb.json"
    file_location = os.getcwd() + output_json_path
    with open(file_location, "w") as outfile:
        outfile.write(json_object)


def format_dynamodb_json(csvreader):
    output = []
    # extract relavant information from row and format
    # in dynamodb json
    for row in csvreader:
        Id = str(row[0])
        IcbCode = str(row[1])
        Board = str(row[2])
        output.append(
            {
                "PutRequest": {
                    "Item": {
                        "Id": {
                            "N": f"{Id}"
                        },
                        "IcbCode": {
                            "S": f"{IcbCode}"
                        },
                        "Board": {
                            "S": f"{Board}"
                        }
                    }
                }
            }
        )
    return output

if __name__ == "__main__":
    # read in data and generate the json output
    file_input_path = "/test-data/Participating_ICBs.csv"
    path_to_file = os.getcwd() + file_input_path
    generate_participating_icb_json(path_to_file, "ParticipatingIcb")

test_csv_data = [
    [1, 'AAA', 'NHS test board'],
    [2, 'BBB', 'NHS test board 1']
]

expected_output_data = [
    {
        "PutRequest": {
            "Item": {
                "Id": {
                    "N": "1"
                },
                "IcbCode": {
                    "S": "AAA"
                },
                "Board": {
                    "S": "NHS test board"
                }
            }
        }
    },
    {
        "PutRequest": {
            "Item": {
                "Id": {
                    "N": "2"
                },
                "IcbCode": {
                    "S": "BBB"
                },
                "Board": {
                    "S": "NHS test board 1"
                }
            }
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data) == expected_output_data

