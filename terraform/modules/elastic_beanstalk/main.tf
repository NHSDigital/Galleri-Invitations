locals {
  source_files = fileset(var.frontend_repo_location, "**/*")
  source_hash  = sha256(join("", [for f in local.source_files : filesha256("${var.frontend_repo_location}/${f}")]))
}

data "aws_route53_zone" "domain" {
  name         = "${var.hostname}."
  private_zone = false 
}

data "archive_file" "screens" {
  type        = "zip"
  source_dir  = var.frontend_repo_location
  output_path = "${path.cwd}/src/${var.name}.zip"
}

# DNS setup

resource "aws_route53_record" "screens" {
  zone_id = data.aws_route53_zone.domain.id
  name    = "${var.environment}.${var.hostname}"
  type    = "A"

  alias {
    name                   = aws_elastic_beanstalk_environment.screens.cname
    zone_id                = data.aws_route53_zone.domain.id
    evaluate_target_health = true
  }
}

resource "aws_acm_certificate" "my_cert" {
  domain_name       = "${var.environment}.${var.hostname}"
  validation_method = "DNS"

  subject_alternative_names = ["www.${var.environment}.${var.hostname}"]

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = var.environment
  }
}

resource "aws_route53_record" "cert_validation" {
  # dvo = domain validation option
  for_each = {
    for dvo in aws_acm_certificate.my_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = data.aws_route53_zone.my_zone.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "my_cert" {
  certificate_arn         = aws_acm_certificate.my_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# Elastic Beanstalk setup

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

resource "aws_iam_role_policy_attachment" "screens" {
  role       = aws_iam_role.screens.name
  policy_arn = "arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier"
}

resource "aws_iam_instance_profile" "screens" {
  name = "${var.environment}-${var.name}-instance_profile"
  role = aws_iam_role.screens.name
}


resource "aws_s3_bucket" "screens" {
  bucket = "${var.environment}-${var.name}-frontend"
}

resource "aws_s3_object" "screens" {
  bucket = aws_s3_bucket.screens.id
  key    = "${var.name}-${local.source_hash}.zip"
  source = data.archive_file.screens.output_path
}

resource "aws_elastic_beanstalk_application" "screens" {
  name        = "${var.environment}-${var.name}"
  description = var.description
}

resource "aws_elastic_beanstalk_application_version" "screens" {
  name        = "${var.environment}-${local.source_hash}"
  application = aws_elastic_beanstalk_application.screens.name
  bucket      = aws_s3_bucket.screens.bucket
  key         = aws_s3_object.screens.key
}

resource "aws_security_group" "screens" {
  name        = "${var.environment}-${var.name}"
  description = "Security group for Elastic Beanstalk environment"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.environment}-${var.name}"
  }
}

# Allow all inbound traffic from members of the group for clustering purposes.
resource "aws_security_group_rule" "local_ingress" {
  security_group_id = aws_security_group.screens.id

  type      = "ingress"
  from_port = 0
  to_port   = 0
  protocol  = "-1"
  self      = true
}

# Allow all outbound traffic.
resource "aws_security_group_rule" "local_egress" {
  security_group_id = aws_security_group.screens.id

  type      = "egress"
  from_port = 0
  to_port   = 0
  protocol  = "-1"
  self      = true
}

# allow inbound http traffic
resource "aws_vpc_security_group_ingress_rule" "http" {
  security_group_id = aws_security_group.screens.id

  from_port   = 80
  to_port     = 80
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}

# allow inbound tcp 8080
resource "aws_vpc_security_group_ingress_rule" "tcp_8080" {
  security_group_id = aws_security_group.screens.id

  from_port   = 8080
  to_port     = 8080
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}

# allow inbound https
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.screens.id

  from_port   = 443
  to_port     = 443
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"
}

resource "aws_elastic_beanstalk_environment" "screens" {
  name                = "${var.environment}-invitations-frontend"
  application         = aws_elastic_beanstalk_application.screens.name
  solution_stack_name = "64bit Amazon Linux 2 v5.8.7 running Node.js 18"
  version_label       = aws_elastic_beanstalk_application_version.screens.name

  setting {
    namespace = "aws:elb:listener:443"
    name      = "ListenerProtocol"
    value     = "HTTPS"
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "InstancePort"
    value     = "80"
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "InstanceProtocol"
    value     = "HTTP"
  }

  setting {
    namespace = "aws:elb:listener:443"
    name      = "SSLCertificateId"
    value     = "arn:aws:acm:region:account-id:certificate/certificate-id" # Replace with your actual certificate ARN
  }

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
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = var.vpc_id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = join(",", [var.subnet_1])
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.screens.id
  }
  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PORT"
    value     = 8080
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
    value     = "http://localhost:3000/"
  }
}
