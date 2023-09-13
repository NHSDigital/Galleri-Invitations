import csv
import json
import os

def generate_nonprod_lsoa_json(file_path, table_name):
    with open(file_path, 'r', encoding='utf-8-sig') as file:
        csvreader = csv.reader(file)
        dynamodb_json_object = format_dynamodb_json(csvreader)

    json_file = { table_name : dynamodb_json_object}
    json_object = json.dumps(json_file, indent=4)

    # create output json file
    output_json_path = "/nonprod-lsoa-data/nonprod_lsoa.json"
    file_location = os.getcwd() + output_json_path
    with open(file_location, "w") as outfile:
        outfile.write(json_object)


def format_dynamodb_json(csvreader):
    output = []

    # extract relevant information from row and format
    # in dynamodb json
    for row in csvreader:
        POSTCODE = str(row[0])
        EASTING_1M = str(row[6])
        NORTHING_1M = str(row[7])
        LSOA_2011 = str(row[8])
        ICB = str(row[11])
        LSOA_2021 = str(row[13])
        IMD_RANK = str(row[15])
        IMD_DECILE = str(row[16])
        output.append(
            {
                "PutRequest": {
                    "Item": {
                        "POSTCODE": {
                            "S": f"{POSTCODE}"
                        },
                        "EASTING_1M": {
                            "N": f"{EASTING_1M}"
                        },
                        "NORTHING_1M": {
                            "N": f"{NORTHING_1M}"
                        },
                        "LSOA_2011": {
                            "S": f"{LSOA_2011}"
                        },
                        "NORTHING_1M": {
                            "N": f"{NORTHING_1M}"
                        },
                        "ICB": {
                            "S": f"{ICB}"
                        },
                        "IMD_RANK": {
                            "N": f"{IMD_RANK}"
                        },
                        "IMD_DECILE": {
                            "N": f"{IMD_DECILE}"
                        }
                    }
                }
            }
        )
    return output

if __name__ == "__main__":
    # read in data and generate the json output
    file_input_path = "/nonprod-lsoa-data/non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv"
    path_to_file = os.getcwd() + file_input_path
    generate_nonprod_lsoa_json(path_to_file, "LSOA_table")

