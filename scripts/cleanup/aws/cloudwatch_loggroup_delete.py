import boto3


def delete_log_groups_with_keyword(keyword):
    client = boto3.client("logs")
    paginator = client.get_paginator("describe_log_groups")

    # Use paginator to get all log groups
    for page in paginator.paginate():
        log_groups = page["logGroups"]

        # Iterate through log groups to find matches
        for log_group in log_groups:
            log_group_name = log_group["logGroupName"]
            if keyword in log_group_name:
                print(f"Deleting log group: {log_group_name}")
                client.delete_log_group(logGroupName=log_group_name)


if __name__ == "__main__":
    delete_log_groups_with_keyword("dev-9")
