import boto3
import time


def delete_node_groups(cluster_name, prefix):
    client = boto3.client("eks")

    # List node groups
    response = client.list_nodegroups(clusterName=cluster_name)
    node_groups = response["nodegroups"]

    # Filter node groups with the specified prefix
    filtered_node_groups = [ng for ng in node_groups if ng.startswith(prefix)]

    # Delete each filtered node group
    for node_group in filtered_node_groups:
        print(f"Deleting node group: {node_group}")
        client.delete_nodegroup(clusterName=cluster_name, nodegroupName=node_group)

    # Wait for each filtered node group to be deleted
    for node_group in filtered_node_groups:
        print(f"Waiting for node group: {node_group} to be deleted")
        waiter = client.get_waiter("nodegroup_deleted")
        waiter.wait(clusterName=cluster_name, nodegroupName=node_group)

        # Adding a sleep time to ensure the node group deletion is propagated
        time.sleep(10)


def wait_for_node_groups_deletion(cluster_name):
    client = boto3.client("eks")
    count = 10

    while True:
        response = client.list_nodegroups(clusterName=cluster_name)
        node_groups = response["nodegroups"]

        if not node_groups:
            break

        print(f"Node groups {node_groups} still exist. Waiting for {count} seconds...")
        count += 10
        time.sleep(10)


def delete_cluster(cluster_name):
    client = boto3.client("eks")

    # Delete the EKS cluster
    print(f"Deleting EKS cluster: {cluster_name}")
    client.delete_cluster(name=cluster_name)

    # Wait for the cluster to be deleted
    print(f"Waiting for EKS cluster: {cluster_name} to be deleted")
    waiter = client.get_waiter("cluster_deleted")
    waiter.wait(name=cluster_name)


def delete_eks_clusters_with_prefix(prefix):
    client = boto3.client("eks")

    # List clusters
    response = client.list_clusters()
    clusters = response["clusters"]

    # Filter clusters with the specified prefix
    filtered_clusters = [cluster for cluster in clusters if cluster.startswith(prefix)]

    # Delete each filtered cluster and its node groups
    for cluster in filtered_clusters:
        delete_node_groups(cluster, prefix)
        wait_for_node_groups_deletion(cluster)
        delete_cluster(cluster)

    print(
        f"EKS clusters and associated node groups with prefix '{prefix}' have been deleted."
    )


if __name__ == "__main__":
    delete_eks_clusters_with_prefix("dev-9")
