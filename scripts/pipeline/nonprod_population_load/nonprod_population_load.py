import csv
import os
import boto3
import uuid
import rstr
import random

ENVIRONMENT = os.getenv("environment")

def generate_nonprod_population_json(file_path, table_name):
    with open(file_path, "r", encoding="utf-8-sig") as file:
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
            lsoa_2011 = str(row[25])
            participant_id_rand_exp = rstr.xeger(r'NHS-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]-[A-HJ-NP-Z][A-HJ-NP-Z][0-9][0-9]')
            gp_practice_code = "GP-CODE-" + str(random.randint(1, 5000))

            if nhs_number and lsoa_2011:
                output.append(
                    {
                        "Put": {
                            "Item": {
                                "PersonId": { "S": f'{str(participant_id_rand_exp)}' },
                                "primary_care_provider": { "S": f"{primary_care_provider}"},
                                "name_prefix": {"S": f"{name_prefix}"},
                                "given_name": {"S": f"{first_given_name}"},
                                "other_given_names": {"S": f"{other_given_names}"},
                                "family_name": {"S": f"{family_name}"},
                                "date_of_birth": {"S": f"{date_of_birth}"},
                                "address_line_1": {"S": f"{address_line_1}"},
                                "address_line_2": {"S": f"{address_line_2}"},
                                "address_line_3": {"S": f"{address_line_3}"},
                                "address_line_4": {"S": f"{address_line_4}"},
                                "address_line_5": {"S": f"{address_line_5}"},
                                "postcode": {"S": f"{postcode}"},
                                "nhs_number": {"N": f"{nhs_number}"},
                                "superseded_by_nhs_number": {"N": "0"},
                                "preferred_language": {"S": f"{preferred_language}"},
                                "gender": { 'N': f'{gender_code}'},
                                'reason_for_removal': { 'S': f'{removal_reason}'},
                                'reason_for_removal_effective_from_date': {'S': f'{removal_date}'},
                                'date_of_death': { 'S': f'{date_of_death}'},
                                'telephone_number': { 'S': f'{telephone_number_home}'},
                                'mobile_number': { 'S': f'{telephone_number_mobile}'},
                                'email_address': {'S': f'{email_address_home}'},
                                'is_interpreter_required': {'S': f'{interpreter_required}'},
                                'Invited': {
                                    'S': f'{Invited}'
                                },
                                'LsoaCode': {
                                    'S': f'{lsoa_2011}'
                                },
                                'identified_to_be_invited': {
                                    'BOOL': False
                                },
                                'participantId': {
                                    'S': f'{str(participant_id_rand_exp)}'
                                },
                                'gp_connect': {'S': f'{gp_practice_code}'},
                                'responsible_icb': {'S': f"{postcode}"},

                                'action': {'S': f'{sensitivity_indicator_flag}'},
                            },
                            "TableName": table_name,
                        },
                    }
                )
    return output


def batch_write_to_dynamodb(lsoa_data):
    # splice array 100 records at a time
    # format and send these to the batch write function
    # repeat till no records are left
    dynamodb_client = boto3.client("dynamodb")
    for i in range(1, 100000, 100):
        upper_bound_slice = i + 100
        test_data = lsoa_data[i:upper_bound_slice]
        dynamodb_client.transact_write_items(TransactItems=test_data)
        if i%10000 == 0:
            print(f"{i} records uploaded")
    return "Finished"


if __name__ == "__main__":
    # read in data and generate the json output
    # Reading in CSV files
    file_input_path_1 = (
        "/nonprod-population-data/male_participants_with_LSOA_Invited.csv"
    )
    file_input_path_2 = (
        "/nonprod-population-data/female_participants_with_LSOA_Invited.csv"
    )
    print("Read in both CSV files")

    male_file = os.getcwd() + file_input_path_1
    female_file = os.getcwd() + file_input_path_2

    print("Initiation male upload")
    generate_nonprod_population_json(male_file, ENVIRONMENT + "-Population")
    print("Male upload complete")
    print("Initiation female upload")
    generate_nonprod_population_json(female_file, ENVIRONMENT + "-Population")
    print("Female upload complete")
