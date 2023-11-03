import json
from scripts.pipeline.nonprod_unique_lsoa_load.nonprod_unique_lsoa_load import format_dynamodb_json

test_csv_data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
]

expected_output_data = [
    {
        "Put": {
            "Item": {
                        'LOCAL_AUT_ORG': {
                            'S': '1'
                        },
                        'NHS_ENG_REGION': {
                            'S': '2'
                        },
                        'SUB_ICB': {
                            'S': '3'
                        },
                        'CANCER_REGISTRY': {
                            'S': '4'
                        },
                        'LSOA_2011': {
                            'S': '5'
                        },
                        'MSOA_2011': {
                            'S': '6'
                        },
                        'CANCER_ALLIANCE': {
                            'N': '7'
                        },
                        'ICB': {
                            'S': '8'
                        },
                        'OA_2021': {
                            'S': '9'
                        },
                        'LSOA_2021': {
                            'S': '10'
                        },
                        'MSOA_2021': {
                            'S': '11'
                        },
                        'IMD_RANK': {
                            'N': '12'
                        },
                        'IMD_DECILE': {
                            'N': '13'
                        },
                        'FORECAST_UPTAKE': {
                            'N': '14'
                        },
                        'AVG_EASTING': {
                            'S': '15'
                        },
                        'AVG_NORTHING': {
                            'N': '16'
                        }
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    print(json.dumps(format_dynamodb_json(test_csv_data, 'Table'), indent=4))
    print("-----------------------------------------------------------------")
    print(json.dumps(expected_output_data, indent=4))
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

