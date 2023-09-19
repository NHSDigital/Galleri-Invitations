import csv
import os
import boto3

def generate_nonprod_lsoa_json(file_path, table_name):
    with open(file_path, 'r', encoding='utf-8-sig') as file:
        csvreader = csv.reader(file)
        dynamodb_json_object = format_dynamodb_json(csvreader, table_name)

    batch_write_to_dynamodb(dynamodb_json_object)

def format_dynamodb_json(csvreader, table_name):
    output = []

    # extract relevant information from row and format
    # in dynamodb json
    for row in csvreader:
        POSTCODE = str(row[0])
        POSTCODE_2 = str(row[1])
        LOCAL_AUT_ORG = str(row[2])
        NHS_ENG_REGION = str(row[3])
        SUB_ICB = str(row[4])
        CANCER_REGISTRY = str(row[5])
        EASTING_1M = str(row[6])
        NORTHING_1M = str(row[7])
        LSOA_2011 = str(row[8])
        MSOA_2011 = str(row[9])
        CANCER_ALLIANCE = str(row[10])
        ICB = str(row[11])
        OA_2021 = str(row[12])
        LSOA_2021 = str(row[13])
        MSOA_2021 = str(row[14])
        IMD_RANK = str(row[15])
        IMD_DECILE = str(row[16])
        output.append(
            {
                'Put': {
                    'Item': {
                        'POSTCODE': {
                            'S': f'{POSTCODE}'
                        },
                        'POSTCODE_2': {
                            'S': f'{POSTCODE_2}'
                        },
                        'LOCAL_AUT_ORG': {
                            'S': f'{LOCAL_AUT_ORG}'
                        },
                        'NHS_ENG_REGION': {
                            'S': f'{NHS_ENG_REGION}'
                        },
                        'SUB_ICB': {
                            'S': f'{SUB_ICB}'
                        },
                        'CANCER_REGISTRY': {
                            'S': f'{CANCER_REGISTRY}'
                        },
                        'EASTING_1M': {
                            'S': f'{EASTING_1M}'
                        },
                        'NORTHING_1M': {
                            'S': f'{NORTHING_1M}'
                        },
                        'LSOA_2011': {
                            'S': f'{LSOA_2011}'
                        },
                        'MSOA_2011': {
                            'S': f'{MSOA_2011}'
                        },
                        'CANCER_ALLIANCE': {
                            'S': f'{CANCER_ALLIANCE}'
                        },
                        'ICB': {
                            'S': f'{ICB}'
                        },
                        'OA_2021': {
                            'S': f'{OA_2021}'
                        },
                        'LSOA_2021': {
                            'S': f'{LSOA_2021}'
                        },
                        'MSOA_2021': {
                            'S': f'{MSOA_2021}'
                        },
                        'IMD_RANK': {
                            'N': f'{IMD_RANK}'
                        },
                        'IMD_DECILE': {
                            'N': f'{IMD_DECILE}'
                        }
                    },
                    'TableName': table_name,
                },
            }
        )
    return output

def batch_write_to_dynamodb(lsoa_data):
    # splice array 100 records at a time
    # format and send these to the batch write function
    # repeat till no records left
    dynamodb_client = boto3.client('dynamodb')
    for i in range(1, 100000, 100):
        if (i % 25000): print("...")
        upper_bound_slice = i+100
        test_data = lsoa_data[i:upper_bound_slice]
        dynamodb_client.transact_write_items(
            TransactItems=test_data
        )
    return 'Finished'



if __name__ == "__main__":
    # read in data and generate the json output
    file_input_path = "/nonprod-lsoa-data/non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv"

    path_to_file = os.getcwd() + file_input_path
    generate_nonprod_lsoa_json(path_to_file, "Lsoa")
