import boto3


def delete_iam_policies_with_prefix(prefix):
    client = boto3.client("iam")

    # Use paginator to get all policies
    paginator = client.get_paginator("list_policies")
    for page in paginator.paginate(Scope="Local"):
        policies = page["Policies"]

        # Iterate through policies to find matches
        for policy in policies:
            policy_name = policy["PolicyName"]
            policy_arn = policy["Arn"]
            if policy_name.startswith(prefix):
                print(f"Deleting policy: {policy_name} with ARN: {policy_arn}")
                # Detach policy from all entities before deleting
                detach_policy_from_entities(client, policy_arn)
                # Delete all non-default policy versions
                delete_policy_versions(client, policy_arn)
                # Finally delete the policy
                client.delete_policy(PolicyArn=policy_arn)


def detach_policy_from_entities(client, policy_arn):
    # Detach policy from all users
    for user in client.list_entities_for_policy(PolicyArn=policy_arn)["PolicyUsers"]:
        client.detach_user_policy(UserName=user["UserName"], PolicyArn=policy_arn)

    # Detach policy from all roles
    for role in client.list_entities_for_policy(PolicyArn=policy_arn)["PolicyRoles"]:
        client.detach_role_policy(RoleName=role["RoleName"], PolicyArn=policy_arn)

    # Detach policy from all groups
    for group in client.list_entities_for_policy(PolicyArn=policy_arn)["PolicyGroups"]:
        client.detach_group_policy(GroupName=group["GroupName"], PolicyArn=policy_arn)


def delete_policy_versions(client, policy_arn):
    versions = client.list_policy_versions(PolicyArn=policy_arn)["Versions"]

    # Delete all non-default versions
    for version in versions:
        if not version["IsDefaultVersion"]:
            print(
                f"Deleting policy version: {version['VersionId']} for policy: {policy_arn}"
            )
            client.delete_policy_version(
                PolicyArn=policy_arn, VersionId=version["VersionId"]
            )


if __name__ == "__main__":
    delete_iam_policies_with_prefix("dev-9")
