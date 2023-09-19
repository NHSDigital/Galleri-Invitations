from scripts.pipeline.nonprod_lsoa_load.nonprod_lsoa_load import format_dynamodb_json

row_1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
row_2 = [11, 22, 33, 44, 55, 66, 77 , 88, 99, 100, 111, 122, 133, 144, 155, 166, 177]

test_csv_data = [
    row_1,
    row_2
]

expected_output_data = [
    {
        "PutRequest": {
            "Item": {
                'POSTCODE': {
                            'S': '1'
                        },
                        'POSTCODE_2': {
                            'S': '2'
                        },
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
                        'EASTING_1M': {
                            'S': '7'
                        },
                        'NORTHING_1M': {
                            'S': '8'
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
                        'OA_2021': {
                            'S': '12'
                        },
                        'LSOA_2021': {
                            'S': '13'
                        },
                        'MSOA_2021': {
                            'S': '14'
                        },
                        'ICB': {
                            'S': '15'
                        },
                        'IMD_RANK': {
                            'N': '16'
                        },
                        'IMD_DECILE': {
                            'N': '17'
                        }
            },
            'TableName': 'Table',
        }
    },
    {
        "PutRequest": {
            "Item": {
                'POSTCODE': {
                            'S': '11'
                        },
                        'POSTCODE_2': {
                            'S': '22'
                        },
                        'LOCAL_AUT_ORG': {
                            'S': '33'
                        },
                        'NHS_ENG_REGION': {
                            'S': '44'
                        },
                        'SUB_ICB': {
                            'S': '55'
                        },
                        'CANCER_REGISTRY': {
                            'S': '66'
                        },
                        'EASTING_1M': {
                            'S': '77'
                        },
                        'NORTHING_1M': {
                            'S': '88'
                        },
                        'LSOA_2011': {
                            'S': '99'
                        },
                        'MSOA_2011': {
                            'S': '100'
                        },
                        'CANCER_ALLIANCE': {
                            'S': '111'
                        },
                        'OA_2021': {
                            'S': '122'
                        },
                        'LSOA_2021': {
                            'S': '133'
                        },
                        'MSOA_2021': {
                            'S': '144'
                        },
                        'ICB': {
                            'S': '155'
                        },
                        'IMD_RANK': {
                            'N': '166'
                        },
                        'IMD_DECILE': {
                            'N': '177'
                        }
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

