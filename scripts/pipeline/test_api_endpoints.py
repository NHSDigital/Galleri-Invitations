#!/usr/bin/python
import os
import boto3
import requests

region = "eu-west-2"
environment = os.getenv("environment")

# define get api's here
clinic_icb_list = {
    "name": "clinic-icb-list",
    "resource_path": "clinic-icb-list",
    "method": "GET",
    "query_string": "?participatingIcb=",
}
clinic_information = {
    "name": "clinic-information",
    "resource_path": "clinic-information",
    "method": "GET",
    "query_string": "?clinicId=UB25Q016&clinicName=x",
}
clinic_summery = {
    "name": "clinic-summary-list",
    "resource_path": "clinic-summary-list",
    "method": "GET",
    "query_string": "?participatingIcb=x",
}
get_lsoa_in_range = {
    "name": "get-lsoa-in-range",
    "resource_path": "get-lsoa-in-range",
    "method": "GET",
    "expected_status_code": 200,
    "expected_response": None,
    "query_string": None,
}
participating_icb_list = {
    "name": "participating-icb-list",
    "resource_path": "participating-icb-list",
    "method": "GET",
    "expected_status_code": 200,
    "expected_response": None,
    "query_string": None,
}
invitation_parameters = {
    "name": "invitation-parameters",
    "resource_path": "invitation-parameters",
    "method": "GET",
    "expected_status_code": 200,
    "expected_response": None,
    "query_string": None,
}


# get = [
#     "clinic-icb-list",
#     "clinic-information",
#     "clinic-summary-list",
#     "invitation-parameters",
#     "participating-icb-list",
#     "target-percentage",
# ]
# # define put api's here
# put = [
#     "invitation-parameters-put-forecast-uptake",
#     "invitation-parameters-put-quintiles",
#     "put-target-percentage",
# ]


# Gets a list of all the API's, we can then process that list to match the names against the ID's
def get_all_urls():
    client = boto3.client("apigateway")
    # Get a list of APIs
    response = client.get_rest_apis()
    return response


# Assembles the url from the api id, api name, environment name and resource path.
# url's follow a standard format, only variable is the ID which we get from get_all_urls
def get_invoke_url(response, api):
    name = api["name"]
    api_name = f"{environment}-{name}"
    resource_path = api["resource_path"]
    api_id = None
    for item in response["items"]:
        if item["name"] == api_name:
            api_id = item["id"]
            break

    if api_id:
        # Construct the invoke URL
        invoke_url = f"https://{api_id}.execute-api.{region}.amazonaws.com/{environment}/{resource_path}"
        return invoke_url
    else:
        print(f"API with the name {api_name} was not found.")
        return None


# This makes a GET call to the specified url
def test_get_request(api_list, api):
    url = get_invoke_url(api_list, api)
    print(url)

    expected_status_code = api["expected_status_code"]
    expected_response = api["expected_response"]

    response = requests.get(url)
    assert (
        response.status_code == expected_status_code
    ), f"Expected {expected_status_code}, got {response.status_code}"
    if expected_response is not None:
        assert (
            response.json() == expected_response
        ), f"Expected {expected_response}, got {response.json()}"
    print(f"GET request to {url} passed with status code {expected_status_code}.")


# This makes a PUT call to the specified url
def test_put_request(url, data, expected_status_code, expected_response=None):
    response = requests.put(url, json=data)
    assert (
        response.status_code == expected_status_code
    ), f"Expected {expected_status_code}, got {response.status_code}"
    if expected_response is not None:
        assert (
            response.json() == expected_response
        ), f"Expected {expected_response}, got {response.json()}"
    print(
        f"PUT request to {url} with data {data} passed with status code {expected_status_code}."
    )


if __name__ == "__main__":
    api_list = get_all_urls()

    # testing get-lsoa-in-range
    # get_lsoa_in_range_url = get_invoke_url(api_list, get_lsoa_in_range)
    test_get_request(api_list, invitation_parameters)
    # test_get_request(api_list, clinic_icb_list)

    # print("Here are all the GET url's")
    # for api in get:
    #     url = get_invoke_url(api_list, api, "dev", api)
    #     print(url)
    # print("\n Here are all the PUT url's")
    # for api in put:
    #     url = get_invoke_url(api_list, api, "dev", api)
    #     print(url)
    # print("Now testing the GET url's:")
    # for api in get:
    #     url = get_invoke_url(api_list, api, "dev", api)
    #     test_get_request(url, 200)
    # print("Now testing the PUT url's")
