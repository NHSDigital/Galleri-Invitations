import os
import boto3
import rstr
import time
import math
import datetime
from datetime import datetime
import random
import time
from random_word import RandomWords

ENVIRONMENT = os.getenv("environment")

def generate_nonprod_data(table_name):
    dynamodb_json_object = create_data_set(table_name)
    batch_write_to_dynamodb(dynamodb_json_object)


def create_data_set(table_name):
    # create 100 records, with  unique fields for sites
    data = []
    street_variation = ["Road", "Street", "Avenue", "Hospital"]
    cities = ["Rivendell", "Gondor", "Mordor", "Hobbiton"]
    participating_icbs = [
        "QE1",
        "QWO",
        "QOQ",
        "QF7",
        "QHG",
        "QM7",
        "QH8",
        "QMJ",
        "QMF",
        "QRV",
        "QWE",
        "QT6",
        "QJK",
        "QOX",
        "QUY",
        "QVV",
        "QR1",
        "QSL",
        "QRL",
        "QU9",
        "QNQ",
        "QXU",
        "QNX",
    ]

    icb_postcodes = {}
    icb_postcodes["QE1"] = ["PR1 1LD","LA1 4RP","FY3 8BP","BB7 9JT","LA12 9DR","BB2 7AE","PR2 9HT",
    "FY3 9JL","LA9 4LR","FY3 8NR","LA9 7RL","BB10 2PQ","PR2 6UB","BB18 5UQ","PR3 2JH","PR1 6AB",
    "WN8 0EN","LA9 7RG","L40 4LA","FY3 8NR"]
    icb_postcodes["QWO"] = ["WF1 4DG","LS7 3PQ","HX3 0PW","BD21 1SA","WF1 5RH","WF2 9SD",
    "BD10 0EP","LS11 0ES","S1 2GU","LS14 6UH","LS12 2AE","HD3 3EA","BD9 6RJ","LS9 7TF","LS1 3EX",
    "BD10 0JE","LS21 2LY","BD20 6ED","HU5 1SW","BD9 6RJ"]
    icb_postcodes["QOQ"] = ["DN15 8QZ","HU4 6BN","HU3 4EL","HU8 0RB","YO32 9XW","HG2 0HF",
    "YO30 4AG","YO43 3FF","DN15 9TA","YO8 4AL","HU16 5JQ","HU6 9RR","S10 5UB","YO31 8HE",
    "HU16 5QJ","DN34 5LP","WF5 9TJ","YO11 2PF","LS15 8GB","DL1 1YN"]
    icb_postcodes["QF7"] = ["S10 2JF","S75 2EP","M22 4RZ","S4 7UD","S5 7AU","S43 4XE","DN22 7XF",
    "S8 0XN","S65 2QL","S75 2EP","S35 1QN","HG2 7SX","S10 2TT","S70 1DR","DN15 8QZ","S10 2TH",
    "DN15 8QZ","S64 0AZ","S8 9JP","LS26 9HG"]
    icb_postcodes["QHG"] = ["MK42 9AS","MK42 9DJ","MK42 9DJ","MK42 9DJ","MK42 9DJ","MK42 9DJ",
    "MK42 9DJ","MK42 9DJ","MK42 9DJ","MK42 9DJ","LU4 8QN","MK6 5LD","MK42 9DJ","MK42 9DJ",
    "MK40 2AW","MK42 9DJ","MK42 9DJ","MK40 2NT","MK42 9DJ","MK9 1SH"]
    icb_postcodes["QM7"] = ["CM23 1FQ","AL3 5PN","CM23 1FQ","AL4 9XR","SG17 5TQ","AL8 6HG",
    "SG1 2FQ","SG1 2FQ","HP2 4AD","SG1 2FQ","SG1 2FQ","PE15 0UG","LU3 3QN","SG1 2FQ","LU6 1LF",
    "AL1 3LD","SG6 3PA","HP2 5XY","AL7 4HQ","LU1 2LJ"]
    icb_postcodes["QH8"] = ["IP1 2BX","IP14 1NE","SS16 5NL","CM1 7ET","CO2 7UW","CM1 3TU",
    "SS16 5NL","SS16 5NL","CO1 1RB","SS16 5NL","IP3 0SP","SS16 5NL	SS16 5NL","CM1 7ET","CM1 7ET",
    "SS16 5NL","LU3 3SR","CM1 7ET","CO12 3SS","SS1 9SB"]
    icb_postcodes["QMJ"] = ["N19 5JG","WC1N 3AJ","WC1N 3HR","MK14 6BL","W1T 7NF","N15 3TH",
    "MK14 6JY","SM2 5PJ","NW5 2BX","MK5 6EY","WC1E 6EB","N1 0QH","WC1E 6AS","NW3 2QG","SW10 9NG",
    "NW1 2PG","WC1N 3LU","WC1E 6EB","N8 8JD","WC1N 3BH"]
    icb_postcodes["QMF"] = ["IG11 9LX","E13 8SL","MK40 2NT","IG3 8YB","E13 8SL","E11 1NR",
    "E11 1NR","E11 1NR","EC1A 7BE","RM16 2PX","IG3 8YB","E1 4DG","E1 4DG","N1 5QJ","E2 0HL",
    "E11 1NR","LU1 2PJ","E13 8AF","E2 0HL","E14 8HQ"]
    icb_postcodes["QRV"] = ["NW1 5JD","TW3 3EB","SW3 6JJ","NW7 2HX","UB1 3HW","WD17 3EX",
    "NW10 7NS","SM2 5NF","HA1 3UJ","TW5 9ER","SW10 9NH","SW6 2FE","TW7 6AF","UB1 3EU","CM20 3AH",
    "UB3 1HA","W5 5TL","NW10 3RY","W12 0HS","W5 5TL"]
    icb_postcodes["QWE"] = ["TW11 0LR","SW19 8ND","SW4 0DE","SM1 4LH","SW18 4HH","SW17 0RE",
    "SM4 5PQ","SW15 4AA","GU22 7HS","CR5 2DB","CR7 7YE","SW19 1RH","SW16 6PX","SM6 0NB","CR7 7YE",
    "TW11 0JL","DA6 7AT","SW17 0QT","SW15 5PN","KT10 0EH"]
    icb_postcodes["QT6"] = ["PL31 2QN","PL31 2HL","PL31 2QN","TR14 7DB","PL31 2QN","PL31 2QN",
    "PL27 7JE","PL31 2QN","PL31 2QN","TR3 7DP","TR1 3LJ","PL31 2QN","TR9 6RR","PL31 2QN",
    "PL31 2QN","PL31 2QN","TR13 8AX","TR1 2NU","TR1 1XU"]
    icb_postcodes["QJK"] = ["EX31 4JB","PL6 7RG","PL6 8AJ","EX8 4DD","TQ9 5GH","PL6 8DH","PL6 8BU",
    "PL15 9JD","EX31 4JB","PL2 3DQ","EX2 5AF","SN14 0GX","EX16 6NT","PL4 7QD","EX1 3PZ","GL51 9TZ",
    "EX23 8LB","PL6 5WR","EX5 2GE","TQ1 3AQ"]
    icb_postcodes["QOX"] = ["BS16 2EW","BS24 7FY","BA1 9BU","SP2 7TU","BS16 2EW","SN10 5DS",
    "BS5 7TJ","BA2 8SQ","BS6 5UB","BS14 9BP","SP2 8AA","SN10 3UF","BH1 3SJ","SN15 2AJ","SN25 2PP",
    "BS14 9BP","SN15 1JW","GL12 8DB","BS14 9BP","SN2 1QR"]
    icb_postcodes["QUY"] = ["BS10 5NB","BS10 5NB","BS23 4TQ","BS10 5NB","BS2 8HW","BS10 5NB",
    "TA8 1ED","BS35 2AB","BS10 5NB","BS1 4LF","BS10 5NB","BS1 3NU","BS10 5NB","BS1 2NT","BS10 5NB",
    "BS10 5NB","BS10 5NB","BS34 5BW","BS10 5NB","BS2 9DA"]
    icb_postcodes["QVV"] = ["DT4 0QE","BH2 5BH","BH7 6JF","BH15 1SZ","DT2 9TB","BH7 6JF",
    "BH13 7LN","BH15 2JB","DT1 3WA","BH1 4HT","BH23 2JX","BH1 4JQ","BH17 7DT","BH20 4HU","DT2 9RL",
    "BH7 6JF","SN13 9GB","DT1 1EE","DT3 5AW","DT4 0QE"]
    icb_postcodes["QR1"] = ["GL14 2AQ","GL7 1JR","GL1 3ND","GL53 7QB","GL1 3ND","GL3 1HX",
    "GL5 4NR","GL3 4AW","GL1 3NN","GL1 3ND","GL1 2TZ","GL53 7QB","GL53 7BY","GL53 7QB","GL1 3PX",
    "HR1 2NS","GL7 2PY","GL20 5QL","GL11 4NZ","GL2 2AA"]
    icb_postcodes["QSL"] = ["TA3 7BL","BA21 4AT","TA22 9EN","BA21 4AT","BA20 2HU","TA1 2PX",
    "BA21 4AT","BA5 2FB","TA1 1PQ","BA4 6QN","TA8 2JU","BA20 2BN","TA2 7PQ","BA11 2FH","BA20 2BX",
    "BA21 4AT","TA24 6DF","BA9 9DQ","TA1 2PX","TA6 5LX"]
    icb_postcodes["QRL"] = ["SO43 7NG","SO40 3WX","PO1 5LU","PO6 4HQ","GU34 1RJ","GU34 1HN",
    "SO50 9DB","SO50 5PB","SO16 6YD","SO14 3DT","PO9 2BF","SO15 3FH","RG22 6PH","PO12 3PW",
    "PO33 1QT","PO15 7LB","PO17 5NA","SO16 6YD","PO13 0GY","SO21 2DZ"]
    icb_postcodes["QU9"] = ["OX1 3EF","HP7 0JD","BT9 7AB","OX3 7LE","OX3 9DU","PO15 7AH",
    "GL53 7AN","HP11 1NH","OX16 9FG","OX4 4XN","OX5 2NU","HP7 0JD","OX3 9RF","HP21 7RD","OX3 7LE",
    "OX26 1DE","CV2 2DX","MK8 1EQ","OX3 9LS","RG18 3PG"]
    icb_postcodes["QNQ"] = ["GU11 1AY","SL1 2BJ","RG41 2RE","RG41 2RE","RG14 7HX","SL1 2BJ",
    "RG41 2RE","RG1 8NQ","RG12 7RX","RG40 1XJ","SL2 2DH","SL1 2BJ","RG1 8NQ","SL1 2BJ","SL1 2BJ",
    "SL2 2DH","SL4 2RX","GU17 0DT","SL1 2BJ","SL6 5DY"]
    icb_postcodes["QXU"] = ["GU2 4LR","KT19 8PH","TW20 8NL","RH1 1AU","RH1 6YY","KT10 9AJ",
    "GU1 4PU","RH11 7EJ","CR3 5RA","KT8 2QG","GU16 7ER","GU2 7XX","GU2 7XX","GU11 1TZ","GU7 1UF",
    "GU2 7RF","KT16 9AU","GU21 2QS","GU2 7XX","KT22 7BA"]
    icb_postcodes["QNX"] = ["BN41 1LB","BN27 4ER","BN2 6DX","PO19 7AB","BN25 1SS","TN37 7RD",
    "GU29 9HY","SW1W 8RH","RH20 1BQ","BN2 5UT","TN40 2DZ","SM7 2AS","PO22 9PP","BN2 4SE",
    "RH16 4EX","TN37 7RE","BN21 2UD","BN1 6GL","RH10 7SL","KT21 2SB"]

    tic1 = time.perf_counter()

    # create previous invite date for all clinics
    datetime_now = datetime.now()
    unixtime_now = time.mktime(datetime_now.timetuple())

    week_unix = 604800
    day_unix = 86400

    # 6 week dates for all clinics, starting 2 weeks from now
    week_date = []
    prev_invite_date = []
    for i in range(1, 7):
        invite_date_unix = unixtime_now + ((i + 1) * week_unix)
        invite_date_object = datetime.utcfromtimestamp(invite_date_unix)
        week_date.append(invite_date_object.strftime("%-d %B %Y"))

        # set previous invite date to between 2 to 3 weeks in the past
        prev_invite_date_unix = unixtime_now - (
            2 * week_unix + (random.randint(1, 7) * day_unix)
        )
        prev_invite_date_object = datetime.utcfromtimestamp(prev_invite_date_unix)
        prev_invite_date.append(prev_invite_date_object.strftime("%A %-d %B %Y"))

    for i in range(1, 100):
        # Add Phlebotomy site
        random_word = RandomWords().get_random_word()

        icd_code = random.choice(participating_icbs)
        #postcode = rstr.xeger(r"([A-Z]){2}([0-20]) [0-9][A-Z]{2}")
        postcode = random.choice(icb_postcodes[icd_code])
        clinic_id = rstr.xeger(r"([A-Z]){2}([0-9]){2}([A-Z])([0-9]){3}")
        clinic_name = f"Phlebotomy clinic {str(i)}"
        address = f"{str(i)} {str(random_word)} {random.choice(street_variation)} , \
            {random.choice(cities)} {postcode}"
        directions = "These will contain directions to the site"
        ods_code = rstr.xeger(r"([A-Z])([0-9]){5}")

        # Generate random weekly phlebotomy capacity
        week_capacity = [
            random.randint(0, 100),
            random.randint(0, 100),
            random.randint(0, 100),
            random.randint(0, 100),
            random.randint(0, 100),
            random.randint(0, 100),
        ]
        availability = sum(week_capacity)
        invite_sent = math.floor(availability / 2)

        data.append(
            {
                "Put": {
                    "Item": {
                        "ClinicId": {"S": f"{str(clinic_id)}"},
                        "ClinicName": {"S": f"{str(clinic_name)}"},
                        'Address': {'S': f'{str(address)}'},
                        'Directions': {'S': f'{str(directions)}'},
                        'ICBCode': {'S': f'{str(icd_code)}'},
                        'ODSCode': {'S': f'{str(ods_code)}'},
                        'Postcode': {'S': f'{str(postcode)}'},
                        'PrevInviteDate': {'S': f'{str(random.choice(prev_invite_date))}'},
                        'WeekCommencingDate':  {
                            'M':  {
                                f'{str(week_date[0])}' : {'N': str(week_capacity[0])},
                                f'{str(week_date[1])}' : {'N': str(week_capacity[1])},
                                f'{str(week_date[2])}' : {'N': str(week_capacity[2])},
                                f'{str(week_date[3])}' : {'N': str(week_capacity[3])},
                                f'{str(week_date[4])}' : {'N': str(week_capacity[4])},
                                f'{str(week_date[5])}' : {'N': str(week_capacity[5])},
                            },
                        },
                        'Availability': {'N': str(availability)},
                        'InvitesSent': {'N': str(invite_sent)},
                        'TargetFillToPercentage': {'N': str(50)},
                        'LastSelectedRange': {'N': str(1)},
                    },
                    "TableName": table_name,
                }
            }
        )
    toc1 = time.perf_counter()
    print(f"Created data set in in {toc1 - tic1:0.4f} seconds")
    return data


def batch_write_to_dynamodb(data):
    dynamodb_client = boto3.client("dynamodb")
    chunk_size = 25
    for i in range(1, len(data), chunk_size):
        upper_bound_slice = i + chunk_size
        test_data = data[i:upper_bound_slice]
        dynamodb_client.transact_write_items(TransactItems=test_data)
    print(f"{len(data)} records added to database")
    return "Finished"


if __name__ == "__main__":
    generate_nonprod_data(ENVIRONMENT + "-PhlebotomySite")
