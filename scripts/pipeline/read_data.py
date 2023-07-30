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

def read_file_participating_icb(file_path):
    with open(file_path, 'r', encoding='utf-8-sig') as file:
        csvreader = csv.reader(file)
        output = []
        for row in csvreader:
            iD = str(row[0])
            icbCode = str(row[1])
            board = str(row[2])
            output.append(
                {
                    "PutRequest": {
                        "Item": {
                            "id": {
                                "N": f"{iD}"
                            },
                            "icbCode": {
                                "S": f"{icbCode}"
                            },
                            "board": {
                                "S": f"{board}"
                            }
                        }
                    }
                }
            )
    json_file = { "ParticipatingIcb" : output}
    json_object = json.dumps(json_file, indent=4)
    print(json_object)
    # create json file
    file_location = os.getcwd() + '/test-data/participating_icb.json'
    with open(file_location, "w") as outfile:
        outfile.write(json_object)

path_to_file = os.getcwd() + '/test-data/Participating_ICBs.csv'
read_file_participating_icb(path_to_file)
