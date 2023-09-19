from scripts.pipeline.nonprod_lsoa_load.nonprod_lsoa_load import format_dynamodb_json

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
            },
            'TableName': 'Table',
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
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

