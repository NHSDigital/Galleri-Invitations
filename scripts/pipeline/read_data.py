import csv
import json

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

def read_file_participating_icb(file):
    with open(f"./{file}", 'r') as file:
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
    # create json file
    with open("/test-data/participating_icb.json", "w") as outfile:
        outfile.write(json_object)

read_file_participating_icb('Participating_ICBs.csv')
