from scripts.pipeline.nonprod_lsoa_load.nonprod_lsoa_load import format_dynamodb_json
import json

test_csv_data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
]

expected_output_data = [
    {
        "Put": {
            "Item": {
                        'LOCAL_AUT_ORG': {
                            'S': '3'
                        },
                        'NHS_ENG_REGION': {
                            'S': '4'
                        },
                        'SUB_ICB': {
                            'S': '5'
                        },
                        'CANCER_REGISTRY': {
                            'S': '6'
                        },
                        'LSOA_2011': {
                            'S': '9'
                        },
                        'MSOA_2011': {
                            'S': '10'
                        },
                        'CANCER_ALLIANCE': {
                            'S': '11'
                        },
                        'ICB': {
                            'S': '12'
                        },
                        'OA_2021': {
                            'S': '13'
                        },
                        'LSOA_2021': {
                            'S': '14'
                        },
                        'MSOA_2021': {
                            'S': '15'
                        },
                        'IMD_RANK': {
                            'N': '16'
                        },
                        'IMD_DECILE': {
                            'N': '17'
                        },
                        'AVG_EASTING': {
                            'S': '18'
                        },
                        'AVG_NORTHING': {
                            'S': '19'
                        }
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

