import csv
import os
import boto3
from random import randrange

environment = os.getenv("environment")


def generate_nonprod_lsoa_json(file_path, table_name):
    with open(file_path, "r", encoding="utf-8-sig") as file:
        csvreader = csv.reader(file)
        dynamodb_json_object = format_dynamodb_json(csvreader, table_name)

    batch_write_to_dynamodb(dynamodb_json_object)


def format_dynamodb_json(csvreader, table_name):
    output = []
    # extract relevant information from row and format
    # in dynamodb json
    for row in csvreader:
        LOCAL_AUT_ORG = str(row[0])
        NHS_ENG_REGION = str(row[1])
        SUB_ICB = str(row[2])
        CANCER_REGISTRY = str(row[3])
        LSOA_2011 = str(row[4])
        MSOA_2011 = str(row[5])
        CANCER_ALLIANCE = str(row[6])
        ICB = str(row[7])
        OA_2021 = str(row[8])
        LSOA_2021 = str(row[9])
        MSOA_2021 = str(row[10])
        IMD_RANK = str(row[11])
        IMD_DECILE = str(row[12])
        FORECAST_UPTAKE = str(randrange(10, 30))
        AVG_EASTING = str(row[13])
        AVG_NORTHING = str(row[14])
        output.append(
            {
                "Put": {
                    "Item": {
                        "LOCAL_AUT_ORG": {"S": f"{LOCAL_AUT_ORG}"},
                        "NHS_ENG_REGION": {"S": f"{NHS_ENG_REGION}"},
                        "SUB_ICB": {"S": f"{SUB_ICB}"},
                        "CANCER_REGISTRY": {"S": f"{CANCER_REGISTRY}"},
                        "LSOA_2011": {"S": f"{LSOA_2011}"},
                        "MSOA_2011": {"S": f"{MSOA_2011}"},
                        "CANCER_ALLIANCE": {"S": f"{CANCER_ALLIANCE}"},
                        "ICB": {"S": f"{ICB}"},
                        "OA_2021": {"S": f"{OA_2021}"},
                        "LSOA_2021": {"S": f"{LSOA_2021}"},
                        "MSOA_2021": {"S": f"{MSOA_2021}"},
                        "IMD_RANK": {"N": f"{IMD_RANK}"},
                        "IMD_DECILE": {"N": f"{IMD_DECILE}"},
                        "FORECAST_UPTAKE": {"N": f"{FORECAST_UPTAKE}"},
                        "AVG_EASTING": {"S": f"{AVG_EASTING}"},
                        "AVG_NORTHING": {"S": f"{AVG_NORTHING}"},
                    },
                    "TableName": table_name,
                },
            }
        )
    return output


def batch_write_to_dynamodb(lsoa_data):
    # splice array 100 records at a time
    # format and send these to the batch write function
    # repeat till no records left
    dynamodb_client = boto3.client("dynamodb")
    for i in range(1, len(lsoa_data), 100):
        upper_bound_slice = i + 100
        test_data = lsoa_data[i:upper_bound_slice]
        # print(test_data)
        # dynamodb_client.transact_write_items(TransactItems=test_data)
        try:
            dynamodb_client.transact_write_items(TransactItems=test_data)
        except Exception as e:
            print(f"Error processing batch {i // 100 + 1}: {str(e)}")
            print("Error occurred with the following data:")
            print(test_data)
    return "Finished"


if __name__ == "__main__":
    # read in data and generate the json output
    file_input_path = "/nonprod-unique-lsoa-data/unique_lsoa_data.csv"

    path_to_file = os.getcwd() + file_input_path
    generate_nonprod_lsoa_json(path_to_file, f"{environment}-UniqueLsoa")
