import csv
import os
import boto3

def generate_nonprod_population_json(file_path, table_name):
    with open(file_path, 'r', encoding='utf-8-sig') as file:
        csvreader = csv.reader(file)
        dynamodb_json_object = format_dynamodb_json(csvreader, table_name)

    batch_write_to_dynamodb(dynamodb_json_object)

def format_dynamodb_json(csvreader, table_name):
    output = []
    # extract relevant information from row and format
    # in dynamodb json
    for row in csvreader:
        if len(row) == 26:
            nhs_number = str(row[0])
            superseded_by_subject_id = str(row[1])
            primary_care_provider = str(row[2])
            name_prefix = str(row[3])
            first_given_name = str(row[4])
            other_given_names = str(row[5])
            family_name = str(row[6])
            date_of_birth = str(row[7])
            gender_code = str(row[8])
            address_line_1 = str(row[9])
            address_line_2 = str(row[10])
            address_line_3 = str(row[11])
            address_line_4 = str(row[12])
            address_line_5 = str(row[13])
            postcode = str(row[14])
            removal_reason = str(row[15])
            removal_date = str(row[16])
            date_of_death = str(row[17])
            telephone_number_home = str(row[18])
            telephone_number_mobile = str(row[19])
            email_address_home = str(row[20])
            preferred_language = str(row[21])
            interpreter_required = str(row[22])
            sensitivity_indicator_flag = str(row[23])
            Invited = str(row[24])
            LSOA_2011 = str(row[25])

            if nhs_number and LSOA_2011:
                output.append(
                    {
                        'Put': {
                            'Item': {
                                'PersonId': {
                                    'S': f'{nhs_number}'
                                },
                                'superseded_by_subject_id': {
                                    'S': f'{superseded_by_subject_id}'
                                },
                                'primary_care_provider': {
                                    'S': f'{primary_care_provider}'
                                },
                                'name_prefix': {
                                    'S': f'{name_prefix}'
                                },
                                'first_given_name': {
                                    'S': f'{first_given_name}'
                                },
                                'other_given_names': {
                                    'S': f'{other_given_names}'
                                },
                                'family_name': {
                                    'S': f'{family_name}'
                                },
                                'date_of_birth': {
                                    'S': f'{date_of_birth}'
                                },
                                'gender_code': {
                                    'S': f'{gender_code}'
                                },
                                'address_line_1': {
                                    'S': f'{address_line_1}'
                                },
                                'address_line_2': {
                                    'S': f'{address_line_2}'
                                },
                                'address_line_3': {
                                    'S': f'{address_line_3}'
                                },
                                'address_line_4': {
                                    'S': f'{address_line_4}'
                                },
                                'address_line_5': {
                                    'S': f'{address_line_5}'
                                },
                                'postcode': {
                                    'S': f'{postcode}'
                                },
                                'removal_reason': {
                                    'S': f'{removal_reason}'
                                },
                                'removal_date': {
                                    'S': f'{removal_date}'
                                },
                                'date_of_death': {
                                    'S': f'{date_of_death}'
                                },
                                'telephone_number_home': {
                                    'S': f'{telephone_number_home}'
                                },
                                'telephone_number_mobile': {
                                    'S': f'{telephone_number_mobile}'
                                },
                                'email_address_home': {
                                    'S': f'{email_address_home}'
                                },
                                'preferred_language': {
                                    'S': f'{preferred_language}'
                                },
                                'interpreter_required': {
                                    'S': f'{interpreter_required}'
                                },
                                'sensitivity_indicator_flag': {
                                    'S': f'{sensitivity_indicator_flag}'
                                },
                                'Invited': {
                                    'S': f'{Invited}'
                                },
                                'LsoaCode': {
                                    'S': f'{LSOA_2011}'
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
    # repeat till no records are left
    dynamodb_client = boto3.client('dynamodb')
    for i in range(1, 100000, 100):
        upper_bound_slice = i+100
        test_data = lsoa_data[i:upper_bound_slice]
        dynamodb_client.transact_write_items(
            TransactItems=test_data
        )
    return 'Finished'



if __name__ == "__main__":
    # read in data and generate the json output
    file_input_path_1 = "/nonprod-population-data/male_participants_with_LSOA_Invited.csv"
    file_input_path_2 = "/nonprod-population-data/female_participants_with_LSOA_Invited.csv"

    path_to_file_1 = os.getcwd() + file_input_path_1
    path_to_file_2 = os.getcwd() + file_input_path_2

    generate_nonprod_population_json(path_to_file_1, "Population")
    generate_nonprod_population_json(path_to_file_2, "Population")
