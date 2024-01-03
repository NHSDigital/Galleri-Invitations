from scripts.pipeline.nonprod_population_load.nonprod_population_load import format_dynamodb_json

test_csv_data = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26]
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
                    'S':'3'
                },
                'name_prefix': {
                    'S':'4'
                },
                'first_given_name': {
                    'S':'5'
                },
                'other_given_names': {
                    'S':'6'
                },
                'family_name': {
                    'S':'7'
                },
                'date_of_birth': {
                    'S':'8'
                },
                'gender_code': {
                    'S':'9'
                },
                'address_line_1': {
                    'S':'10'
                },
                'address_line_2': {
                    'S':'11'
                },
                'address_line_3': {
                    'S':'12'
                },
                'address_line_4': {
                    'S':'13'
                },
                'address_line_5': {
                    'S':'14'
                },
                'postcode': {
                    'S':'15'
                },
                'removal_reason': {
                    'S':'16'
                },
                'removal_date': {
                    'S':'17'
                },
                'date_of_death': {
                    'S':'18'
                },
                'telephone_number_home': {
                    'S':'19'
                },
                'telephone_number_mobile': {
                    'S':'20'
                },
                'email_address_home': {
                    'S':'21'
                },
                'preferred_language': {
                    'S':'22'
                },
                'interpreter_required': {
                    'S':'23'
                },
                'sensitivity_indicator_flag': {
                    'S':'24'
                },
                'Invited': {
                    'S':'25'
                },
                'LsoaCode': {
                    'S':'26'
                },
                'identified_to_be_invited': {
                    'BOOL': False
                }
            },
            'TableName': 'Table',
        }
    }
]


def test_format_dynamodb_json():
    assert format_dynamodb_json(test_csv_data, 'Table') == expected_output_data
