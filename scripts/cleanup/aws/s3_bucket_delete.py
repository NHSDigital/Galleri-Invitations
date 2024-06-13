import boto3


def delete_all_objects(bucket_name):
    s3 = boto3.resource("s3")
    bucket = s3.Bucket(bucket_name)
    bucket.object_versions.delete()
    bucket.objects.delete()


def delete_bucket(bucket_name):
    s3 = boto3.client("s3")
    s3.delete_bucket(Bucket=bucket_name)


def delete_buckets_with_prefix(prefix):
    s3 = boto3.client("s3")
    response = s3.list_buckets()

    for bucket in response["Buckets"]:
        bucket_name = bucket["Name"]
        if bucket_name.startswith(prefix):
            print(f"Deleting all objects from bucket: {bucket_name}")
            delete_all_objects(bucket_name)
            print(f"Deleting bucket: {bucket_name}")
            delete_bucket(bucket_name)
            print(f"Bucket {bucket_name} deleted successfully")


if __name__ == "__main__":
    delete_buckets_with_prefix("dev-9")
