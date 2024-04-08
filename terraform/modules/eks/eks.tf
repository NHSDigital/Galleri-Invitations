provider "kubernetes" {
}

resource "aws_eks_cluster" "cluster" {
  name     = "${var.environment}-${var.name}"
  role_arn = aws_iam_role.eks.arn

  vpc_config {
    subnet_ids = var.subnet_ids
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_AmazonEKSClusterPolicy,
    aws_iam_role_policy_attachment.eks_AmazonEKSServicePolicy,
  ]
}

resource "aws_eks_fargate_profile" "default_namespace" {
  cluster_name           = aws_eks_cluster.cluster.name
  fargate_profile_name   = "${var.environment}-${var.name}-default"
  pod_execution_role_arn = aws_iam_role.fargate_pod_execution.arn
  subnet_ids             = var.subnet_ids

  selector {
    namespace = "default"
  }
}

resource "aws_eks_fargate_profile" "system_namespace" {
  cluster_name           = aws_eks_cluster.cluster.name
  fargate_profile_name   = "${var.environment}-${var.name}-kube-system"
  pod_execution_role_arn = aws_iam_role.fargate_pod_execution.arn
  subnet_ids             = var.subnet_ids

  selector {
    namespace = "kube-system"
  }
}

resource "aws_iam_role" "eks" {
  name = "${var.environment}_${var.name}_eks_role"

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

resource "aws_iam_role_policy_attachment" "eks_AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks.name
}

resource "aws_iam_role" "fargate_pod_execution" {
  name = "${var.environment}_${var.name}_fargate_pod_execution_role"

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




# resource "aws_iam_role_policy_attachment" "AmazonEKSClusterPolicy" {
#   policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
#   role       = aws_iam_role.eks.name
# }

# resource "aws_iam_role_policy_attachment" "AmazonEKSServicePolicy" {
#   policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
#   role       = aws_iam_role.eks.name
# }

# resource "aws_iam_role_policy_attachment" "AmazonEKSVPCResourceController" {
#   policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
#   role       = aws_iam_role.eks.name
# }






resource "aws_iam_role_policy_attachment" "fargate_pod_execution_AmazonEKSFargatePodExecutionRolePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy"
  role       = aws_iam_role.fargate_pod_execution.name
}


resource "aws_iam_role_policy_attachment" "eks_AmazonEKSServicePolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSServicePolicy"
  role       = aws_iam_role.eks.name
}

resource "aws_security_group" "cluster" {
  name        = "${var.environment}-${var.name}"
  description = "Security group for Elastic Beanstalk environment"
  vpc_id      = var.vpc_id
}

resource "aws_security_group_rule" "https" {
  security_group_id = aws_security_group.cluster.id
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "ssh" {
  security_group_id = aws_security_group.cluster.id
  type              = "ingress"
  from_port         = 22
  to_port           = 22
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "egress" {
  security_group_id = aws_security_group.cluster.id
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
}
