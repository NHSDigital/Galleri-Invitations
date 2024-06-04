import time
import boto3


def delete_vaults_with_prefix(prefix):
    # Create a Backup service client
    client = boto3.client("backup")

    # List all backup vaults
    vaults = client.list_backup_vaults()["BackupVaultList"]

    # Filter vaults that start with the specified prefix
    filtered_vaults = [
        vault for vault in vaults if vault["BackupVaultName"].startswith(prefix)
    ]

    for vault in filtered_vaults:
        vault_name = vault["BackupVaultName"]
        print(f"Processing vault: {vault_name}")

        # List all recovery points in the vault
        recovery_points = client.list_recovery_points_by_backup_vault(
            BackupVaultName=vault_name
        )["RecoveryPoints"]

        # Delete each recovery point
        for point in recovery_points:
            recovery_point_arn = point["RecoveryPointArn"]
            print(f"Deleting recovery point: {recovery_point_arn}")
            client.delete_recovery_point(
                BackupVaultName=vault_name, RecoveryPointArn=recovery_point_arn
            )

        # Give time for the delete to finish
        time.sleep(5)

        # Delete the backup vault
        print(f"Deleting vault: {vault_name}")
        client.delete_backup_vault(BackupVaultName=vault_name)


# Usage
delete_vaults_with_prefix("dev-9")
