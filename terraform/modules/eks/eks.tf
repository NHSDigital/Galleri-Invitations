# Create a new VPC
resource "aws_vpc" "eks_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = {
    Name = "${var.environment}-${var.name}"
  }
}

# Create subnets
resource "aws_subnet" "eks_subnet" {
  count = 2

  vpc_id                  = aws_vpc.eks_vpc.id
  cidr_block              = count.index == 0 ? "10.0.1.0/24" : "10.0.2.0/24"
  availability_zone       = element(data.aws_availability_zones.available.names, count.index)
  map_public_ip_on_launch = true

  tags = {
    Name                                                   = "${var.environment}_${var.name}_eks_subnet_${count.index}"
    "kubernetes.io/cluster/${var.environment}-${var.name}" = "shared"
    "kubernetes.io/role/elb"                               = "1"
  }
}

# EKS cluster IAM role
resource "aws_iam_role" "eks_cluster_role" {
  name = "${var.environment}-${var.name}-eks"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
      },
    ]
  })
}

# Attach IAM policies to the EKS cluster role
resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_service_policy" {
  role       = aws_iam_role.eks_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
}

# Fargate profile IAM role
resource "aws_iam_role" "fargate_profile_role" {
  name = "${var.environment}-${var.name}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "eks-fargate-pods.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "fargate_pod_execution_role_policy" {
  role       = aws_iam_role.fargate_profile_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy"
}

# EKS Cluster
resource "aws_eks_cluster" "eks_cluster" {
  name     = "${var.environment}-${var.name}"
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids = aws_subnet.eks_subnet[*].id
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
    aws_iam_role_policy_attachment.eks_service_policy,
  ]
}

# Fargate Profile
resource "aws_eks_fargate_profile" "default" {
  cluster_name           = aws_eks_cluster.eks_cluster.name
  fargate_profile_name   = "${var.environment}-${var.name}-default"
  pod_execution_role_arn = aws_iam_role.fargate_profile_role.arn
  subnet_ids             = aws_subnet.eks_subnet[*].id

  selector {
    namespace = "default"
  }
}

resource "aws_eks_fargate_profile" "kube_system" {
  cluster_name           = aws_eks_cluster.eks_cluster.name
  fargate_profile_name   = "${var.environment}-${var.name}-kube-system"
  pod_execution_role_arn = aws_iam_role.fargate_profile_role.arn
  subnet_ids             = aws_subnet.eks_subnet[*].id

  selector {
    namespace = "kube-system"
  }
}

# Fetch availability zones
data "aws_availability_zones" "available" {}

output "cluster_endpoint" {
  value = aws_eks_cluster.eks_cluster.endpoint
}

output "cluster_identity_oidc_issuer" {
  value = aws_eks_cluster.eks_cluster.identity[0].oidc[0].issuer
}
