from scripts.pipeline.nonprod_lsoa_load.nonprod_lsoa_load import format_dynamodb_json

test_csv_data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
]

expected_output_data = [
    {
        'Put': {
            'Item': {
                'PersonId': {
                    'S':'1'
                },
                'superseded_by_subject_id': {
                    'S':'2'
                },
                'primary_care_provider': {
                    'S':'4'
                },
                'name_prefix': {
                    'S':'5'
                },
                'first_given_name': {
                    'S':'6'
                },
                'other_given_names': {
                    'S':'7'
                },
                'family_name': {
                    'S':'8'
                },
                'date_of_birth': {
                    'S':'9'
                },
                'gender_code': {
                    'S':'10'
                },
                'address_line_1': {
                    'S':'11'
                },
                'address_line_2': {
                    'S':'12'
                },
                'address_line_3': {
                    'S':'13'
                },
                'address_line_4': {
                    'S':'14'
                },
                'address_line_5': {
                    'S':'15'
                },
                'postcode': {
                    'S':'16'
                },
                'removal_reason': {
                    'S':'17'
                },
                'removal_date': {
                    'S':'18'
                },
                'date_of_death': {
                    'S':'19'
                },
                'telephone_number_home': {
                    'S':'20'
                },
                'telephone_number_mobile': {
                    'S':'21'
                },
                'email_address_home': {
                    'S':'22'
                },
                'preferred_language': {
                    'S':'23'
                },
                'interpreter_required': {
                    'S':'24'
                },
                'sensitivity_indicator_flag': {
                    'S':'25'
                },
                'Invited': {
                    'S':'26'
                },
                'LsoaCode': {
                    'S':'27'
                }
            },
            'TableName': 'table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data

