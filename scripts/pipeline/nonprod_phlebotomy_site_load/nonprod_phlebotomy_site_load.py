import boto3
import json
import rstr
import time
import math
import datetime
from datetime import datetime
import random
import time
from random_word import RandomWords


def generate_nonprod_data(table_name):
    dynamodb_json_object = create_data_set(table_name)
    batch_write_to_dynamodb(dynamodb_json_object)


def create_data_set(table_name):
    # create 100 records, with  unique fields for sites
    data = []
    street_variation = ['Road', 'Street', 'Avenue', 'Hospital']
    cities = ['Rivendell', 'Gondor', 'Mordor', 'Hobbiton']
    tic1 = time.perf_counter()

    # create previous invite date for all clinics
    datetime_now = datetime.now()
    unixtime_now = time.mktime(datetime_now.timetuple())

    # set previous invite date to be 2 weeks in the past
    week_unix = 604800
    prev_invite_date_unix = unixtime_now - (2 * week_unix)
    prev_invite_date_object = datetime.utcfromtimestamp(prev_invite_date_unix)
    prev_invite_date = prev_invite_date_object.strftime("%A %-d %B %Y")

    # 6 week dates for all clinics, starting 2 weeks from now
    week_date = []
    for i in range (1,7):
        invite_date_unix = unixtime_now + ((i+1) * week_unix)
        invite_date_object = datetime.utcfromtimestamp(invite_date_unix)
        week_date.append(invite_date_object.strftime("%-d %B %Y"))

    for i in range(1, 10):
        # Add Phlebotomy site
        random_word = RandomWords().get_random_word()

        postcode = rstr.xeger(r'([A-Z]){2}([0-20]) [0-9][A-Z]{2}')
        clinic_id = rstr.xeger(r'([A-Z]){2}([0-9]){2}([A-Z])([0-9]){3}')
        clinic_name = f'Phlebotomy clinic {str(i)}'
        address = f'{str(i)} {str(random_word)} {random.choice(street_variation)} , \
            {random.choice(cities)} {postcode}'
        directions = 'These will contain directions to the site'
        ods_code = rstr.xeger(r'([A-Z])([0-9]){5}')
        icd_code = rstr.xeger(r'([A-Z])([0-9]){5}')

        # Generate random weekly phlebotomy capacity
        week_capacity = [
            random.randint(0,100), random.randint(0,100), random.randint(0,100),
            random.randint(0,100), random.randint(0,100), random.randint(0,100)
        ]
        availability = sum(week_capacity)
        invite_sent = math.floor(availability / 2)

        data.append(
            {
                'Put': {
                    'Item': {
                        'ClinicId': {
                            'S': f'{str(clinic_id)}'
                        },
                        'ClinicName': {
                            'S': f'{str(clinic_name)}'
                        },
                        'Address': {
                            'S': f'{str(address)}'
                        },
                        'Directions': {
                            'S': f'{str(directions)}'
                        },
                        'ICBCode': {
                            'S': f'{str(icd_code)}'
                        },
                        'ODSCode': {
                            'S': f'{str(ods_code)}'
                        },
                        'PostCode': {
                            'S': f'{str(postcode)}'
                        },
                        'PrevInviteDate': {
                            'S': f'{str(prev_invite_date)}'
                        },
                        'WeekCommencingDate':  {
                            'M':  {
                                f'{str(week_date[0])}' : {
                                    'N': str(week_capacity[0])
                                },
                                f'{str(week_date[1])}' : {
                                    'N': str(week_capacity[1])
                                },
                                f'{str(week_date[2])}' : {
                                    'N': str(week_capacity[2])
                                },
                                f'{str(week_date[3])}' : {
                                    'N': str(week_capacity[3])
                                },
                                f'{str(week_date[4])}' : {
                                    'N': str(week_capacity[4])
                                },
                                f'{str(week_date[5])}' : {
                                    'N': str(week_capacity[5])
                                }
                                }
                        },
                        'Availability': {
                            'N': str(availability)
                        },
                        'InvitesSent': {
                            'N': str(invite_sent)
                        },
                        },
                    'TableName': table_name
                }
            }
        )
    toc1 = time.perf_counter()
    print(f"Created data set in in {toc1 - tic1:0.4f} seconds")
    return data

def batch_write_to_dynamodb(data):
    dynamodb_client = boto3.client('dynamodb')
    chunk_size = 25
    for i in range(1, len(data), chunk_size):
        upper_bound_slice = i + chunk_size
        test_data = data[i:upper_bound_slice]
        dynamodb_client.transact_write_items(
            TransactItems=test_data
        )
    print(f'{len(data)} records added to database')
    return 'Finished'



if __name__ == "__main__":
    generate_nonprod_data('PhlebotomySite')
