from scripts.pipeline.nonprod_lsoa_load.nonprod_lsoa_load import format_dynamodb_json

test_csv_data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
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
                            'S': '7'
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
                        'AVG_EASTING': {
                            'S': '14'
                        },
                        'AVG_NORTHING': {
                            'S': '15'
                        }
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

