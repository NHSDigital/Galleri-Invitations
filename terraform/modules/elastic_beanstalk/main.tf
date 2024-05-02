locals {
  source_files = fileset(var.frontend_repo_location, "**/*")
  source_hash  = sha256(join("", [for f in local.source_files : filesha256("${var.frontend_repo_location}/${f}")]))
}

data "archive_file" "screens" {
  type        = "zip"
  source_dir  = var.frontend_repo_location
  output_path = "${path.cwd}/src/${var.name}.zip"
}

data "aws_route53_zone" "example" {
  name         = "${var.hostname}."
  private_zone = false
}

# Setup DNS records, this is a bit of a roundabot process but the way it works is the first three blocks are just to validate
# ownership of the domain, it does this by creating a hostname with a unique prefix and then checks it to verify
# everything is correct.

resource "aws_acm_certificate" "example" {
  domain_name       = "${var.environment}.${var.hostname}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "example" {
  for_each = {
    for dvo in aws_acm_certificate.example.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.example.zone_id
}

resource "aws_acm_certificate_validation" "example" {
  certificate_arn         = aws_acm_certificate.example.arn
  validation_record_fqdns = [for record in aws_route53_record.example : record.fqdn]
}

# Once we have validated that the domain is owned and correct then we create the actual record
resource "aws_route53_record" "actual_record" {
  zone_id = data.aws_route53_zone.example.id
  name    = "${var.environment}.${var.hostname}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${var.environment}-${var.dns_zone}-gps-cancer-detection-blood-test.${var.region}.elasticbeanstalk.com"]
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
  depends_on  = [aws_acm_certificate_validation.example]
}

# Security Group for the Elastic Beanstalk environment
resource "aws_security_group" "screens" {
  name        = "${var.environment}-${var.name}"
  description = "Security group for Elastic Beanstalk environment"
  vpc_id      = var.vpc_id
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
  solution_stack_name = var.solution_stack_name
  version_label       = aws_elastic_beanstalk_application_version.screens.name
  cname_prefix        = "${var.environment}-${var.dns_zone}-gps-cancer-detection-blood-test"

  depends_on = [aws_acm_certificate_validation.example]

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "InstanceType"
    value     = var.instance_size
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "ListenerProtocol"
    value     = "HTTPS"
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "SSLCertificateId"
    value     = aws_acm_certificate_validation.example.certificate_arn
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "InstancePort"
    value     = "80"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    # value     = "LoadBalanced"
    value = "SingleInstance"
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

  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = var.vpc_id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = "${var.subnet_1},${var.subnet_2}"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_ENVIRONMENT"
    value     = var.environment
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_QUINTILES"
    value     = var.NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_QUINTILES
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_CLINIC_ICB_LIST"
    value     = var.NEXT_PUBLIC_CLINIC_ICB_LIST
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_INVITATION_PARAMETERS"
    value     = var.NEXT_PUBLIC_INVITATION_PARAMETERS
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_CLINIC_INFORMATION"
    value     = var.NEXT_PUBLIC_CLINIC_INFORMATION
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_FORECAST_UPTAKE"
    value     = var.NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_FORECAST_UPTAKE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_PARTICIPATING_ICB_LIST"
    value     = var.NEXT_PUBLIC_PARTICIPATING_ICB_LIST
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_CALCULATE_NUM_TO_INVITE"
    value     = var.NEXT_PUBLIC_CALCULATE_NUM_TO_INVITE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_GET_LSOA_IN_RANGE"
    value     = var.NEXT_PUBLIC_GET_LSOA_IN_RANGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_PUT_TARGET_PERCENTAGE"
    value     = var.NEXT_PUBLIC_PUT_TARGET_PERCENTAGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_CLINIC_SUMMARY_LIST"
    value     = var.NEXT_PUBLIC_CLINIC_SUMMARY_LIST
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_TARGET_PERCENTAGE"
    value     = var.NEXT_PUBLIC_TARGET_PERCENTAGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_GENERATE_INVITES"
    value     = var.NEXT_PUBLIC_GENERATE_INVITES
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_GET_USER_ROLE"
    value     = var.NEXT_PUBLIC_GET_USER_ROLE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXT_PUBLIC_CIS2_SIGNED_JWT"
    value     = var.NEXT_PUBLIC_CIS2_SIGNED_JWT
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "USERS"
    value = jsonencode([
      {
        "id" : "1",
        "name" : "dev",
        "role" : "Invitation Planner",
        "email" : "dev@nhs.net",
        "password" : "Testing"
      },
      {
        "id" : "2",
        "name" : "test",
        "role" : "Invitation Planner",
        "email" : "test@nhs.net",
        "password" : "Testing"
      },
      {
        "id" : "3",
        "name" : "dev_2",
        "role" : "Referring Clinician",
        "email" : "dev2@nhs.net",
        "password" : "Testing"
      },
      {
        "id" : "4",
        "name" : "test_2",
        "role" : "Referring Clinician",
        "email" : "test2@nhs.net",
        "password" : "Testing"
      },
      {
        "id" : "5",
        "name" : "pen",
        "email" : "pen@nhs.net",
        "password" : "Testing"
      }
    ])
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "CIS2_ID"
    value     = "328183617639.apps.supplier"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "CIS2_SECRET"
    value     = var.CIS2_SECRET
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXTAUTH_SECRET"
    value     = var.NEXTAUTH_SECRET
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NEXTAUTH_URL"
    value     = "https://${var.environment}.${var.hostname}"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "GALLERI_ACTIVITY_CODE"
    value     = "B1824"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "GALLERI_ACTIVITY_NAME"
    value     = "Galleri Blood Test"
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.screens.id
  }
}
