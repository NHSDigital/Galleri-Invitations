locals {
  source_files = fileset(var.frontend_repo_location, "**/*")
  source_hash  = sha256(join("", [for f in local.source_files : filesha256("${var.frontend_repo_location}/${f}")]))
}

data "archive_file" "screens" {
  type        = "zip"
  source_dir  = var.frontend_repo_location
  output_path = "${path.cwd}/src/${var.name}.zip"
}

# IAM Role for Elastic Beanstalk environment's EC2 instances
resource "aws_iam_role" "screens" {
  name = "${var.environment}-${var.name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        },
      },
    ],
  })
}

# Attach the default policy for Elastic Beanstalk Web Tier to the IAM role
resource "aws_iam_role_policy_attachment" "screens" {
  role       = aws_iam_role.screens.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

# IAM Instance Profile for Elastic Beanstalk environment's EC2 instances
resource "aws_iam_instance_profile" "screens" {
  name = "${var.environment}-${var.name}-instance_profile"
  role = aws_iam_role.screens.name
}

# S3 Bucket for storing application versions
resource "aws_s3_bucket" "screens" {
  bucket = "${var.environment}-${var.name}-frontend"
}

# S3 Object for the application version
resource "aws_s3_object" "screens" {
  bucket = aws_s3_bucket.screens.id
  key    = "${var.name}-${local.source_hash}.zip"
  source = data.archive_file.screens.output_path
}

# Elastic Beanstalk Application
resource "aws_elastic_beanstalk_application" "screens" {
  name        = "${var.environment}-${var.name}"
  description = var.description
}

# Elastic Beanstalk Application Version
resource "aws_elastic_beanstalk_application_version" "screens" {
  name        = "${var.environment}-${local.source_hash}"
  application = aws_elastic_beanstalk_application.screens.name
  bucket      = aws_s3_bucket.screens.bucket
  key         = aws_s3_object.screens.key
}

# Security Group for the Elastic Beanstalk environment
resource "aws_security_group" "screens" {
  name        = "${var.environment}-${var.name}"
  description = "Security group for Elastic Beanstalk environment"
  vpc_id      = var.vpc_id
}

# Inbound rules for HTTP and HTTPS
resource "aws_security_group_rule" "http" {
  security_group_id = aws_security_group.screens.id
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

resource "aws_security_group_rule" "https" {
  security_group_id = aws_security_group.screens.id
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
}

# Elastic Beanstalk Environment
resource "aws_elastic_beanstalk_environment" "screens" {
  name                = "${var.environment}-${var.name}-frontend"
  application         = aws_elastic_beanstalk_application.screens.name
  solution_stack_name = "64bit Amazon Linux 2 v5.8.7 running Node.js 18"
  version_label       = aws_elastic_beanstalk_application_version.screens.name

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "SingleInstance"
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.screens.name
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.screens.id
  }
}
