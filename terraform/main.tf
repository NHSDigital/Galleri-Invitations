terraform {
  backend "s3" {
    dynamodb_table = "terraform-state-lock-dynamo"
    encrypt        = true
  }
  required_providers {
    null = {
      source = "hashicorp/null"
    }
    tls = {
      source = "hashicorp/tls"
    }
    time = {
      source = "hashicorp/time"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
  default_tags {
    tags = {
      Environment = var.environment
      Terraform   = "True"
    }
  }
}

module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  name        = "Galleri-VPC"
}

# Deploy frontend in elastic beanstalk
module "galleri_invitations_screen" {
  source                                                = "./modules/elastic_beanstalk"
  name                                                  = "gallery-invitations"
  description                                           = "The frontend for interacting with the invitations system"
  frontend_repo_location                                = var.frontend_repo_location
  environment                                           = var.environment
  vpc_id                                                = module.vpc.vpc_id
  subnet_1                                              = module.vpc.subnet_ids[0]
  subnet_2                                              = module.vpc.subnet_ids[1]
  NEXT_PUBLIC_CALCULATE_NUM_TO_INVITE                   = module.calculate_number_to_invite_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_CLINIC_ICB_LIST                           = module.clinic_icb_list_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_CLINIC_INFORMATION                        = module.clinic_information_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_CLINIC_SUMMARY_LIST                       = module.clinic_summary_list_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_GET_LSOA_IN_RANGE                         = module.lsoa_in_range_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_INVITATION_PARAMETERS                     = module.invitation_parameters_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_FORECAST_UPTAKE = module.invitation_parameters_put_forecast_uptake_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_QUINTILES       = module.invitation_parameters_put_quintiles_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_PARTICIPATING_ICB_LIST                    = module.participating_icb_list_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_PUT_TARGET_PERCENTAGE                     = module.target_fill_to_percentage_put_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_TARGET_PERCENTAGE                         = module.target_fill_to_percentage_get_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_GENERATE_INVITES                          = module.generate_invites_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_AUTHENTICATOR                             = module.authenticator_lambda_api_gateway.rest_api_galleri_id
  USERS                                                 = var.USERS
  CIS2_ID                                               = var.CIS2_ID
  NEXTAUTH_URL                                          = var.NEXTAUTH_URL
  CIS2_REDIRECT_URL                                     = var.CIS2_REDIRECT_URL
  GALLERI_ACTIVITY_CODE                                 = var.GALLERI_ACTIVITY_CODE
  hostname                                              = var.invitations_hostname
  dns_zone                                              = var.dns_zone
  region                                                = var.region
}

# the role that all lambda's are utilising,
# we will replace this with individual roles in a future ticket
module "iam_galleri_lambda_role" {
  source      = "./modules/iam_galleri_role"
  role_name   = var.role_name
  environment = var.environment
  account_id  = var.account_id
}

# This is the module which will run the invitations frontend in S3
# further development is needed but storing progress on this module for post-mvp
# module "frontend-invitations" {
#   source      = "./modules/cloudfront"
#   name        = "invitations-frontend"
#   environment = var.environment
# }

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = "${var.environment}-eks-cluster"
  cluster_version = "1.29"

  cluster_endpoint_public_access = true

  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
    }
  }

  vpc_id                   = module.vpc.vpc_id
  subnet_ids               = module.vpc.subnet_ids
  control_plane_subnet_ids = module.vpc.subnet_ids

  # EKS Managed Node Group(s)
  eks_managed_node_group_defaults = {
    instance_types = ["t3.small"]
  }

  eks_managed_node_groups = {
    example = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_types = ["t3.small"]
      capacity_type  = "SPOT"
    }
  }

  # Cluster access entry
  # To add the current caller identity as an administrator
  enable_cluster_creator_admin_permissions = true

  access_entries = {
    # One access entry with a policy associated
    example = {
      kubernetes_groups = []
      principal_arn     = "arn:aws:iam::${var.account_id}:role/aws-reserved/sso.amazonaws.com/eu-west-2/${var.sso_iam_role_arn}"

      policy_associations = {
        eksAdmin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        },
        clusterAdmin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        },
      }
    }
  }
}

module "s3_bucket" {
  source                  = "./modules/s3"
  bucket_name             = var.bucket_name
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "test_data_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "galleri-test-data"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "gp_practices_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "gp-practices-bucket"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "user_accounts_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "user-accounts-bucket"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "gps_public_keys_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "gps-public-keys-bucket"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

# CaaS MESH data bucket
module "caas_data_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "galleri-caas-data"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "validated_records_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "galleri-processed-caas-data"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

# GTMS buckets for each JSON response header
module "invalid_gtms_payload_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "invalid-gtms-payload"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "invited_participant_batch" {
  source                  = "./modules/s3"
  bucket_name             = "outbound-gtms-invited-participant-batch"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "clinic_data_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-gtms-clinic-create-or-update"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "processed_clinic_data_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "processed-inbound-gtms-clinic-create-or-update"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "clinic_schedule_summary" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-gtms-clinic-schedule-summary"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "processed_clinic_schedule_summary_bucket" {
  source                  = "./modules/s3"
  bucket_name             = "processed-inbound-gtms-clinic-schedule-summary"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "gtms_appointment" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-gtms-appointment"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "gtms_appointment_validated" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-gtms-appointment-validated"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}
module "gtms_withdrawal" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-gtms-withdrawal"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "processed_gtms_withdrawal" {
  source                  = "./modules/s3"
  bucket_name             = "processed-inbound-gtms-withdrawal"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "gtms_invited_participant_batch" {
  source                  = "./modules/s3"
  bucket_name             = "sent-gtms-invited-participant-batch"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "proccessed_appointments" {
  source                  = "./modules/s3"
  bucket_name             = "processed-appointments"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}
# End of GTMS buckets

# NRDS Buckets
module "proccessed_nrds" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-processed-nrds-data"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}
# End of NRDS buckets

# Data Filter Gridall IMD
module "data_filter_gridall_imd_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "dataFilterLambda"
  lambda_timeout       = 900
  memory_size          = 4096
  lambda_s3_object_key = "data_filter_gridall_imd_lambda.zip"
  # account_id           = var.account_id
  environment_vars = {
    BUCKET_NAME     = "galleri-ons-data",
    GRIDALL_CHUNK_1 = "gridall/chunk_data/chunk_1.csv",
    GRIDALL_CHUNK_2 = "gridall/chunk_data/chunk_2.csv",
    GRIDALL_CHUNK_3 = "gridall/chunk_data/chunk_3.csv",
    ENVIRONMENT     = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# LSOA loader
module "lsoa_loader_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "lsoaLoaderLambda"
  lambda_timeout       = 900
  memory_size          = 2048
  lambda_s3_object_key = "non_prod_lsoa_loader.zip"
  environment_vars = {
    BUCKET_NAME = "galleri-ons-data",
    KEY         = "lsoa_data/lsoa_data_2023-08-15T15:42:13.301Z.csv",
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "sns_alert_lambda" {
  source               = "./modules/alert_lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "SNSAlertLambda"
  lambda_timeout       = 900
  memory_size          = 2048
  lambda_s3_object_key = "sns_alert_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
    url         = var.teams_url
  }
}

# clinic information
module "clinic_information_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "clinicInformationLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "clinic_information_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "clinic_information_api_gateway" {
  source            = "./modules/api-gateway"
  environment       = var.environment
  lambda_invoke_arn = module.clinic_information_lambda.lambda_invoke_arn
  path_part         = "clinic-information"
  method_http_parameters = {
    "method.request.querystring.clinicId"   = true,
    "method.request.querystring.clinicName" = true
  }
  lambda_function_name = module.clinic_information_lambda.lambda_function_name
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}


# Clinic icb list
module "clinic_icb_list_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "clinicIcbListLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "clinic_icb_list_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "clinic_icb_list_api_gateway" {
  source            = "./modules/api-gateway"
  environment       = var.environment
  lambda_invoke_arn = module.clinic_icb_list_lambda.lambda_invoke_arn
  path_part         = "clinic-icb-list"
  method_http_parameters = {
    "method.request.querystring.participatingIcb" = true
  }
  lambda_function_name = module.clinic_icb_list_lambda.lambda_function_name
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}


# participating icb list
module "participating_icb_list_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "participatingIcbListLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "participating_icb_list_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "participating_icb_list_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.participating_icb_list_lambda.lambda_invoke_arn
  path_part              = "participating-icb-list"
  method_http_parameters = {}
  lambda_function_name   = module.participating_icb_list_lambda.lambda_function_name
  hostname               = var.invitations_hostname
  dns_zone               = var.dns_zone
}


# clinic summary list
module "clinic_summary_list_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "clinicSummaryListLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "clinic_summary_list_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "clinic_summary_list_api_gateway" {
  source            = "./modules/api-gateway"
  environment       = var.environment
  lambda_invoke_arn = module.clinic_summary_list_lambda.lambda_invoke_arn
  path_part         = "clinic-summary-list"
  method_http_parameters = {
    "method.request.querystring.participatingIcb" = true
  }
  lambda_function_name = module.clinic_summary_list_lambda.lambda_function_name
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}


# Invitation Parameters
module "invitation_parameters_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "invitationParametersLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "invitation_parameters_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "invitation_parameters_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.invitation_parameters_lambda.lambda_invoke_arn
  path_part              = "invitation-parameters"
  method_http_parameters = {}
  lambda_function_name   = module.invitation_parameters_lambda.lambda_function_name
  hostname               = var.invitations_hostname
  dns_zone               = var.dns_zone
}


# Invitation Parameters Put Forcast Uptake
module "invitation_parameters_put_forecast_uptake_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "invitationParametersPutForecastUptakeLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "invitation_parameters_put_forecast_uptake_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "invitation_parameters_put_forecast_uptake_api_gateway" {
  source                    = "./modules/api-gateway"
  environment               = var.environment
  lambda_invoke_arn         = module.invitation_parameters_put_forecast_uptake_lambda.lambda_invoke_arn
  path_part                 = "invitation-parameters-put-forecast-uptake"
  method_http_parameters    = {}
  lambda_api_gateway_method = "PUT"
  lambda_function_name      = module.invitation_parameters_put_forecast_uptake_lambda.lambda_function_name
  method                    = "/*/PUT/*"
  hostname                  = var.invitations_hostname
  dns_zone                  = var.dns_zone
}


# Invitations Parameters Put Quintiles
module "invitation_parameters_put_quintiles_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "invitationParametersPutQuintilesLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "invitation_parameters_put_quintiles_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "invitation_parameters_put_quintiles_api_gateway" {
  source                    = "./modules/api-gateway"
  environment               = var.environment
  lambda_invoke_arn         = module.invitation_parameters_put_quintiles_lambda.lambda_invoke_arn
  path_part                 = "invitation-parameters-put-quintiles"
  method_http_parameters    = {}
  lambda_api_gateway_method = "PUT"
  lambda_function_name      = module.invitation_parameters_put_quintiles_lambda.lambda_function_name
  method                    = "/*/PUT/*"
  hostname                  = var.invitations_hostname
  dns_zone                  = var.dns_zone
}


# Target Fill to Percentage PUT
module "target_fill_to_percentage_put_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "targetFillToPercentagePutLambda"
  lambda_s3_object_key = "target_fill_to_percentage_put_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "target_fill_to_percentage_put_api_gateway" {
  source                    = "./modules/api-gateway"
  environment               = var.environment
  lambda_invoke_arn         = module.target_fill_to_percentage_put_lambda.lambda_invoke_arn
  path_part                 = "put-target-percentage"
  method_http_parameters    = {}
  lambda_api_gateway_method = "PUT"
  integration_response_http_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  lambda_function_name = module.target_fill_to_percentage_put_lambda.lambda_function_name
  method               = "/*/PUT/*"
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}


# Target Fill to Percentage GET
module "target_fill_to_percentage_get_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "targetFillToPercentageLambda"
  lambda_s3_object_key = "target_fill_to_percentage_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "target_fill_to_percentage_get_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.target_fill_to_percentage_get_lambda.lambda_invoke_arn
  path_part              = "target-percentage"
  method_http_parameters = {}
  lambda_function_name   = module.target_fill_to_percentage_get_lambda.lambda_function_name
  hostname               = var.invitations_hostname
  dns_zone               = var.dns_zone
}

# LSOA in range
module "lsoa_in_range_lambda" {
  source               = "./modules/lambda"
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "getLsoaInRangeLambda"
  lambda_s3_object_key = "get_lsoa_in_range_lambda.zip"
  environment          = var.environment
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "lsoa_in_range_api_gateway" {
  source            = "./modules/api-gateway"
  lambda_invoke_arn = module.lsoa_in_range_lambda.lambda_invoke_arn
  path_part         = "get-lsoa-in-range"
  method_http_parameters = {
    "method.request.querystring.clinicPostcode" = true,
    "method.request.querystring.miles"          = true
  }

  lambda_function_name = module.lsoa_in_range_lambda.lambda_function_name
  environment          = var.environment
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}

# Population in LSOA
module "participants_in_lsoa_lambda" {
  source               = "./modules/lambda"
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "getLsoaParticipantsLambda"
  lambda_s3_object_key = "get_participants_in_lsoa_lambda.zip"
  environment          = var.environment
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Calculate number of participatnts to invite
module "calculate_number_to_invite_lambda" {
  source               = "./modules/lambda"
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "calculateNumberToInviteLambda"
  lambda_s3_object_key = "calculate_number_to_invite.zip"
  environment          = var.environment
  lambda_timeout       = 100
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "calculate_number_to_invite_api_gateway" {
  source                    = "./modules/api-gateway"
  lambda_invoke_arn         = module.calculate_number_to_invite_lambda.lambda_invoke_arn
  path_part                 = "calculate-num-to-invite"
  method_http_parameters    = {}
  lambda_api_gateway_method = "POST"
  integration_response_http_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'POST,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  lambda_function_name = module.calculate_number_to_invite_lambda.lambda_function_name
  method               = "/*/POST/*"
  environment          = var.environment
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}

# Calculate number of participatnts to invite
module "generate_invites_lambda" {
  source               = "./modules/lambda"
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "generateInvitesTriggerLambda"
  lambda_s3_object_key = "generate_invites.zip"
  environment          = var.environment
  lambda_timeout       = 100
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "generate_invites_api_gateway" {
  source                    = "./modules/api-gateway"
  lambda_invoke_arn         = module.generate_invites_lambda.lambda_invoke_arn
  path_part                 = "generate-invites"
  method_http_parameters    = {}
  lambda_api_gateway_method = "POST"
  integration_response_http_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'POST,GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  lambda_function_name = module.generate_invites_lambda.lambda_function_name
  method               = "/*/POST/*"
  environment          = var.environment
  hostname             = var.invitations_hostname
  dns_zone             = var.dns_zone
}

# GP Practices Loader
module "gp_practices_loader_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gpPracticesLoaderLambda"
  lambda_timeout       = 900
  memory_size          = 2048
  lambda_s3_object_key = "gp_practices_loader.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "gp_practices_loader_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.gp_practices_bucket.bucket_id
  bucket_arn = module.gp_practices_bucket.bucket_arn
  lambda_arn = module.gp_practices_loader_lambda.lambda_arn
}

# Create Episode Records
module "create_episode_record_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "createEpisodeRecords"
  lambda_timeout       = 900
  memory_size          = 1024
  lambda_s3_object_key = "create_episode_record.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "create_episode_record_dynamodb_stream" {
  source                             = "./modules/dynamodb_stream"
  enabled                            = true
  event_source_arn                   = module.population_table.dynamodb_stream_arn
  function_name                      = module.create_episode_record_lambda.lambda_function_name
  starting_position                  = "LATEST"
  batch_size                         = 200
  maximum_batching_window_in_seconds = 300
  filter                             = { eventName : ["MODIFY"] }
}

# Add Episode History
module "add_episode_history_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "addEpisodeHistoryLambda"
  lambda_timeout       = 900
  memory_size          = 1024
  lambda_s3_object_key = "add_episode_history.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "add_episode_history_dynamodb_stream" {
  source                             = "./modules/dynamodb_stream"
  enabled                            = true
  event_source_arn                   = module.episode_table.dynamodb_stream_arn
  function_name                      = module.add_episode_history_lambda.lambda_function_name
  starting_position                  = "LATEST"
  batch_size                         = 200
  maximum_batching_window_in_seconds = 30
}

module "gtms_appointment_event_booked_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gtmsAppointmentEventBookedLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gtms_appointment_event_booked_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}",
    DATEPARAM   = "5"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "appointments_event_cancelled_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "appointmentsEventCancelledLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "appointments_event_cancelled_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# module "appointments_event_cancelled_lambda_trigger" {
#   source        = "./modules/lambda_trigger"
#   bucket_id     = module.proccessed_appointments.bucket_id
#   bucket_arn    = module.proccessed_appointments.bucket_arn
#   lambda_arn    = module.appointments_event_cancelled_lambda.lambda_arn
#   filter_prefix = "validRecords/valid_records-"
# }

# User Accounts Lambda
module "user_accounts_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "userAccountsLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "user_accounts_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "user_accounts_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.user_accounts_bucket.bucket_id
  bucket_arn    = module.user_accounts_bucket.bucket_arn
  lambda_arn    = module.user_accounts_lambda.lambda_arn
  filter_prefix = "user-accounts-"
  filter_suffix = ".csv"
}

module "gtms_status_update_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gtmsStatusUpdateLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gtms_status_update_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "gtms_status_update_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.processed_gtms_withdrawal.bucket_id
  bucket_arn    = module.processed_gtms_withdrawal.bucket_arn
  lambda_arn    = module.gtms_status_update_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records_withdrawal"
}

module "validate_gtms_withdrawal_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateGtmsWithdrawalLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "validate_gtms_withdrawal_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_gtms_withdrawal_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.gtms_withdrawal.bucket_id
  bucket_arn = module.gtms_withdrawal.bucket_arn
  lambda_arn = module.validate_gtms_withdrawal_lambda.lambda_arn
}


module "poll_mesh_mailbox_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "pollMeshMailboxLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "poll_mesh_mailbox_lambda.zip"
  environment_vars = {
    ENVIRONMENT                  = "${var.environment}",
    MESH_SANDBOX                 = "false",
    MESH_CHUNK_VALUE             = "2001",
    MESH_URL                     = jsondecode(data.aws_secretsmanager_secret_version.mesh_url.secret_string)["MESH_URL"],
    MESH_SHARED_KEY              = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"],
    MESH_SENDER_MAILBOX_ID       = jsondecode(data.aws_secretsmanager_secret_version.mesh_sender_mailbox_id.secret_string)["MESH_SENDER_MAILBOX_ID"],
    MESH_SENDER_MAILBOX_PASSWORD = jsondecode(data.aws_secretsmanager_secret_version.mesh_sender_mailbox_password.secret_string)["MESH_SENDER_MAILBOX_PASSWORD"],
    CAAS_MESH_MAILBOX_ID         = jsondecode(data.aws_secretsmanager_secret_version.caas_mesh_mailbox_id.secret_string)["CAAS_MESH_MAILBOX_ID"],
    CAAS_MESH_MAILBOX_PASSWORD   = jsondecode(data.aws_secretsmanager_secret_version.caas_mesh_mailbox_password.secret_string)["CAAS_MESH_MAILBOX_PASSWORD"],
    EXIT_TIME                    = "12",
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# GTMS Validate Appointment Lambda
module "validate_gtms_appointment_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateGtmsAppointmentLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "validate_gtms_appointment_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_gtms_appointment_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.gtms_appointment.bucket_id
  bucket_arn = module.gtms_appointment.bucket_arn
  lambda_arn = module.validate_gtms_appointment_lambda.lambda_arn
}

# Validate Appointment Common Data Lambda
module "validate_appointment_common_data_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateAppointmentCommonDataLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "validate_appointment_common_data_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_appointment_common_data_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.gtms_appointment_validated.bucket_id
  bucket_arn    = module.gtms_appointment_validated.bucket_arn
  lambda_arn    = module.validate_appointment_common_data_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records_add-"
}

# ProcessEventNotification
module "process_event_notification_dynamodb_stream" {
  source                             = "./modules/dynamodb_stream"
  enabled                            = true
  event_source_arn                   = module.episode_history_table.dynamodb_stream_arn
  function_name                      = module.process_event_notification_lambda.lambda_function_name
  starting_position                  = "LATEST"
  batch_size                         = 200
  maximum_batching_window_in_seconds = 300
  filter                             = { dynamodb : { NewImage : { Episode_Event : { S : [{ "anything-but" : ["Invited"] }] } } } }
}

# ProcessEventNotification lambda
module "process_event_notification_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "processEventNotificationLambda"
  lambda_timeout       = 900
  memory_size          = 1024
  lambda_s3_object_key = "process_event_notification_lambda.zip"
  environment_vars = {
    ENVIRONMENT   = "${var.environment}"
    SQS_QUEUE_URL = module.notify_raw_message_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Create GTMS Invitation Batch
module "create_invitation_batch_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "createInvitationBatchLambda"
  lambda_timeout       = 900
  memory_size          = 1024
  lambda_s3_object_key = "create_invitation_batch_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "create_invitation_batch_dynamodb_stream" {
  source                             = "./modules/dynamodb_stream"
  enabled                            = true
  event_source_arn                   = module.episode_history_table.dynamodb_stream_arn
  function_name                      = module.create_invitation_batch_lambda.lambda_function_name
  starting_position                  = "LATEST"
  batch_size                         = 200
  maximum_batching_window_in_seconds = 300
  filter                             = { dynamodb : { NewImage : { Episode_Event : { S : ["Invited"] } } } }
}

# GTMS MESH lambda
module "gtms_mesh_mailbox_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gtmsMeshMailboxLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gtms_mesh_mailbox_lambda.zip"
  environment_vars = {
    ENVIRONMENT                = "${var.environment}",
    MESH_SANDBOX               = "false",
    MESH_URL                   = jsondecode(data.aws_secretsmanager_secret_version.mesh_url.secret_string)["MESH_URL"],
    MESH_SHARED_KEY            = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"],
    GTMS_MESH_MAILBOX_ID       = jsondecode(data.aws_secretsmanager_secret_version.gtms_mesh_mailbox_id.secret_string)["GTMS_MESH_MAILBOX_ID"],
    GTMS_MESH_MAILBOX_PASSWORD = jsondecode(data.aws_secretsmanager_secret_version.gtms_mesh_mailbox_password.secret_string)["GTMS_MESH_MAILBOX_PASSWORD"],
    CLINIC_WORKFLOW            = "GTMS_CLINIC",
    CLINIC_SCHEDULE_WORKFLOW   = "GTMS_CLINIC_SCHEDULE",
    APPOINTMENT_WORKFLOW       = "GTMS_APPOINTMENT",
    WITHDRAW_WORKFLOW          = "GTMS_WITHDRAW",
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# NRDS MESH lambda
module "nrds_mesh_mailbox_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "nrdsMeshMailboxLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "nrds_mesh_mailbox_lambda.zip"
  environment_vars = {
    ENVIRONMENT                    = "${var.environment}",
    MESH_SHARED_KEY                = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"],
    MESH_RECEIVER_MAILBOX_ID       = jsondecode(data.aws_secretsmanager_secret_version.sand_mesh_mailbox_id.secret_string)["SAND_MESH_MAILBOX_ID"],
    MESH_RECEIVER_MAILBOX_PASSWORD = jsondecode(data.aws_secretsmanager_secret_version.sand_mesh_mailbox_password.secret_string)["SAND_MESH_MAILBOX_PASSWORD"],
    K8_URL                         = "${var.K8_URL}",
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "nrds_update_blood_test_result_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "nrdsUpdateBloodTestResultLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "nrds_update_blood_test_result_lambda.zip"
  environment_vars = {
    ENVIRONMENT   = "${var.environment}",
    FAILUREBUCKET = "inbound-nrds-galleritestresult-step4-error",
    SUCCESSBUCKET = "inbound-nrds-galleritestresult-step4-success",
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "nrds_update_blood_test_result_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.inbound_nrds_galleritestresult_step3_success.bucket_id
  bucket_arn    = module.inbound_nrds_galleritestresult_step3_success.bucket_arn
  lambda_arn    = module.nrds_update_blood_test_result_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records"
}

# GTMS Validate clinic Lambda
module "validate_clinic_data_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateClinicDataLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "validate_clinic_data_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_clinic_data_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.clinic_data_bucket.bucket_id
  bucket_arn    = module.clinic_data_bucket.bucket_arn
  lambda_arn    = module.validate_clinic_data_lambda.lambda_arn
  filter_prefix = "clinic_create_or_update_"
}

# GTMS upload clinic data
module "gtms_upload_clinic_data_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gtmsUploadClinicDataLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gtms_upload_clinic_data_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "gtms_upload_clinic_data_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.processed_clinic_data_bucket.bucket_id
  bucket_arn    = module.processed_clinic_data_bucket.bucket_arn
  lambda_arn    = module.gtms_upload_clinic_data_lambda.lambda_arn
  filter_prefix = "validRecords/clinic_create_or_update_"
}

# GPS public key jwks
module "gps_jwks_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gpsJwksLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gps_jwks_lambda.zip"
  environment_vars = {
    ENVIRONMENT        = "${var.environment}",
    PUBLIC_KEYS_BUCKET = "${module.gps_public_keys_bucket.bucket_id}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "gps_jwks_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.gps_jwks_lambda.lambda_invoke_arn
  path_part              = "gps-jwks"
  method_http_parameters = {}
  lambda_function_name   = module.gps_jwks_lambda.lambda_function_name
  hostname               = var.invitations_hostname
  dns_zone               = var.dns_zone
}

# Authenticator Lambda
module "authenticator_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "authenticatorLambda"
  lambda_timeout       = 900
  memory_size          = 1024
  lambda_s3_object_key = "authenticator_lambda.zip"
  environment_vars = {
    ENVIRONMENT             = "${var.environment}",
    CIS2_ID                 = "${var.CIS2_ID}",
    CIS2_TOKEN_ENDPOINT_URL = "${var.CIS2_TOKEN_ENDPOINT_URL}",
    CIS2_PUBLIC_KEY_ID      = "${var.CIS2_PUBLIC_KEY_ID}",
    CIS2_KEY_NAME           = "${var.CIS2_KNAME}"
    CIS2_REDIRECT_URL       = "https://${var.environment}.${var.invitations_hostname}/api/auth/callback/cis2"
    GALLERI_ACTIVITY_CODE   = "${data.aws_secretsmanager_secret_version.galleri_activity_code.secret_string}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Retrieve Galleri activity code
data "aws_secretsmanager_secret_version" "galleri_activity_code" {
  secret_id = "GALLERI_ACTIVITY_CODE"
}

module "authenticator_lambda_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.authenticator_lambda.lambda_invoke_arn
  path_part              = "authenticator-lambda"
  method_http_parameters = {}
  lambda_function_name   = module.authenticator_lambda.lambda_function_name
  hostname               = var.invitations_hostname
  dns_zone               = var.dns_zone
}


# GTMS validate clinic capacity
module "validate_clinic_capacity_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateClinicCapacityLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "validate_clinic_capacity_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_clinic_capacity_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.clinic_schedule_summary.bucket_id
  bucket_arn    = module.clinic_schedule_summary.bucket_arn
  lambda_arn    = module.validate_clinic_capacity_lambda.lambda_arn
  filter_prefix = "clinic_schedule_summary"
}


# GTMS upload clinic capacity data
module "gtms_upload_clinic_capacity_data_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "gtmsUploadClinicCapacityDataLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "gtms_upload_clinic_capacity_data_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "gtms_upload_clinic_capacity_data_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.processed_clinic_schedule_summary_bucket.bucket_id
  bucket_arn    = module.processed_clinic_schedule_summary_bucket.bucket_arn
  lambda_arn    = module.gtms_upload_clinic_capacity_data_lambda.lambda_arn
  filter_prefix = "validRecords/clinic_schedule_summary"
}

# Send Invitaion Batch to GTMS
module "send_GTMS_invitation_batch_lambda" {
  source          = "./modules/lambda"
  environment     = var.environment
  bucket_id       = module.s3_bucket.bucket_id
  lambda_iam_role = module.iam_galleri_lambda_role.galleri_lambda_role_arn

  lambda_function_name = "sendGTMSInvitationBatchLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "send_GTMS_invitation_batch_lambda.zip"
  environment_vars = {
    ENVIRONMENT                   = "${var.environment}",
    MESH_SANDBOX                  = "false",
    WORKFLOW_ID                   = "GPS_INVITATIONS",
    MESH_URL                      = jsondecode(data.aws_secretsmanager_secret_version.mesh_url.secret_string)["MESH_URL"],
    MESH_SHARED_KEY               = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"],
    MESH_SENDER_MAILBOX_ID        = jsondecode(data.aws_secretsmanager_secret_version.gtms_mesh_mailbox_id.secret_string)["GTMS_MESH_MAILBOX_ID"],
    MESH_SENDER_MAILBOX_PASSWORD  = jsondecode(data.aws_secretsmanager_secret_version.gtms_mesh_mailbox_password.secret_string)["GTMS_MESH_MAILBOX_PASSWORD"],
    GTMS_MESH_RECEIVER_MAILBOX_ID = jsondecode(data.aws_secretsmanager_secret_version.gtms_mesh_receiver_mailbox_id.secret_string)["GTMS_MESH_RECEIVER_MAILBOX_ID"],
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "send_GTMS_invitation_batch_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.invited_participant_batch.bucket_id
  bucket_arn = module.invited_participant_batch.bucket_arn
  lambda_arn = module.send_GTMS_invitation_batch_lambda.lambda_arn
}

# Send Invitation Batch to Raw Message Queue
module "send_invitation_batch_to_raw_message_queue_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "sendInvitationBatchToRawMessageQueueLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "send_invitation_batch_to_raw_message_queue_lambda.zip"
  environment_vars = {
    ENVIRONMENT   = "${var.environment}"
    SQS_QUEUE_URL = module.notify_raw_message_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "send_invitation_batch_to_raw_message_queue_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.gtms_invited_participant_batch.bucket_id
  bucket_arn = module.gtms_invited_participant_batch.bucket_arn
  lambda_arn = module.send_invitation_batch_to_raw_message_queue_lambda.lambda_arn
}

# Notify Raw Message Queue
module "notify_raw_message_queue_sqs" {
  source                         = "./modules/sqs"
  environment                    = var.environment
  name                           = "notifyRawMessageQueue.fifo"
  is_fifo_queue                  = true
  is_content_based_deduplication = true
  visibility_timeout_seconds     = 100
}

# Send Enriched Message to Notify Queue
module "send_enriched_message_to_notify_queue_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "sendEnrichedMessageToNotifyQueueLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "send_enriched_message_to_notify_queue_lambda.zip"
  environment_vars = {
    ENVIRONMENT                = "${var.environment}"
    RAW_MESSAGE_QUEUE_URL      = module.notify_raw_message_queue_sqs.sqs_queue_url
    ENRICHED_MESSAGE_QUEUE_URL = module.notify_enriched_message_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "send_enriched_message_to_notify_queue_SQS_trigger" {
  source           = "./modules/lambda_sqs_trigger"
  event_source_arn = module.notify_raw_message_queue_sqs.sqs_queue_arn
  lambda_arn       = module.send_enriched_message_to_notify_queue_lambda.lambda_arn
}

# Notify Enriched Message Queue
module "notify_enriched_message_queue_sqs" {
  source                         = "./modules/sqs"
  environment                    = var.environment
  name                           = "notifyEnrichedMessageQueue.fifo"
  is_fifo_queue                  = true
  is_content_based_deduplication = true
  visibility_timeout_seconds     = 370
}

# Send Single Notify Message
module "send_single_notify_message_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "sendSingleNotifyMessageLambda"
  lambda_timeout       = 370
  memory_size          = 1024
  lambda_s3_object_key = "send_single_notify_message_lambda.zip"
  environment_vars = {
    ENVIRONMENT                = "${var.environment}"
    API_KEY                    = "${var.NOTIFY_API_KEY}"
    PRIVATE_KEY_NAME           = "${var.NOTIFY_KNAME}"
    PUBLIC_KEY_ID              = "${var.NOTIFY_PUBLIC_KEY_ID}"
    TOKEN_ENDPOINT_URL         = "${var.NOTIFY_TOKEN_ENDPOINT_URL}"
    MESSAGES_ENDPOINT_URL      = "${var.NOTIFY_MESSAGES_ENDPOINT_URL}"
    INITIAL_RETRY_DELAY        = 5000
    MAX_RETRIES                = 3
    ENRICHED_MESSAGE_QUEUE_URL = module.notify_enriched_message_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "send_single_notify_message_SQS_trigger" {
  source           = "./modules/lambda_sqs_trigger"
  event_source_arn = module.notify_enriched_message_queue_sqs.sqs_queue_arn
  lambda_arn       = module.send_single_notify_message_lambda.lambda_arn
}

# Test Result Acknowledgement Queue
module "test_result_ack_queue_sqs" {
  source                         = "./modules/sqs"
  environment                    = var.environment
  name                           = "testResultAckQueue.fifo"
  is_fifo_queue                  = true
  is_content_based_deduplication = true
  visibility_timeout_seconds     = 100
}

# Send Test Result Error Acknowledgement Queue Lambda
module "send_test_result_error_ack_queue_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "sendTestResultErrorAckQueueLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "send_test_result_error_ack_queue_lambda.zip"
  environment_vars = {
    ENVIRONMENT               = "${var.environment}"
    TEST_RESULT_ACK_QUEUE_URL = module.test_result_ack_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Lambda triggers for Step 1-4 fhir validation error buckets
module "fhir_validation_step1_error_bucket_lambda_trigger" {
  source       = "./modules/lambda_trigger"
  statement_id = "${var.environment}-AllowExecution-Step-1"
  bucket_id    = module.inbound_nrds_galleritestresult_step1_error.bucket_id
  bucket_arn   = module.inbound_nrds_galleritestresult_step1_error.bucket_arn
  lambda_arn   = module.send_test_result_error_ack_queue_lambda.lambda_arn
}

module "fhir_validation_step2_error_bucket_lambda_trigger" {
  source       = "./modules/lambda_trigger"
  statement_id = "${var.environment}-AllowExecution-Step-2"
  bucket_id    = module.inbound_nrds_galleritestresult_step2_error.bucket_id
  bucket_arn   = module.inbound_nrds_galleritestresult_step2_error.bucket_arn
  lambda_arn   = module.send_test_result_error_ack_queue_lambda.lambda_arn
}

module "fhir_validation_step3_error_bucket_lambda_trigger" {
  source       = "./modules/lambda_trigger"
  statement_id = "${var.environment}-AllowExecution-Step-3"
  bucket_id    = module.inbound_nrds_galleritestresult_step3_error.bucket_id
  bucket_arn   = module.inbound_nrds_galleritestresult_step3_error.bucket_arn
  lambda_arn   = module.send_test_result_error_ack_queue_lambda.lambda_arn
}

module "fhir_validation_step4_error_bucket_lambda_trigger" {
  source       = "./modules/lambda_trigger"
  statement_id = "${var.environment}-AllowExecution-Step-4"
  bucket_id    = module.inbound_nrds_galleritestresult_step4_error.bucket_id
  bucket_arn   = module.inbound_nrds_galleritestresult_step4_error.bucket_arn
  lambda_arn   = module.send_test_result_error_ack_queue_lambda.lambda_arn
}

# SNS Topic to publish and read test result ok Acknowledgement response
module "test_result_topic" {
  source      = "./modules/sns_topic"
  environment = var.environment
  name        = "testResultTopic"
}

# Send Test Result Ok Acknowledgement Lambda
module "send_test_result_ok_ack_queue_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "sendTestResultOkAckQueueLambda"
  lambda_timeout       = 370
  memory_size          = 1024
  lambda_s3_object_key = "send_test_result_ok_ack_queue_lambda.zip"
  environment_vars = {
    ENVIRONMENT               = "${var.environment}"
    TEST_RESULT_ACK_QUEUE_URL = module.test_result_ack_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Lambda subscription/trigger for Test result SNS Topic
module "send_test_result_ok_ack_queue_lambda_sns_topic_subscription" {
  source                = "./modules/lambda_sns_trigger"
  sns_topic_arn         = module.test_result_topic.sns_topic_arn
  subscription_endpoint = module.send_test_result_ok_ack_queue_lambda.lambda_arn
  lambda_name           = module.send_test_result_ok_ack_queue_lambda.lambda_function_name
}

# Delete Caas feed records
module "caas_feed_delete_records_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "caasFeedDeleteRecordsLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "caas_feed_delete_records_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}
# trigger replaced by group trigger for bucket

# Validate Test Result Report using FHIR Validation Service
module "test_result_report_fhir_validation_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "testResultReportFhirValidationLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "test_result_report_fhir_validation_lambda.zip"
  environment_vars = {
    ENVIRONMENT                 = "${var.environment}"
    TRR_SUCCESSFUL_BUCKET       = "inbound-nrds-galleritestresult-step1-success"
    TRR_UNSUCCESSFUL_BUCKET     = "inbound-nrds-galleritestresult-step1-error"
    FHIR_VALIDATION_SERVICE_URL = "FHIR_VALIDATION_SERVICE_URL"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "test_result_report_fhir_validation_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.proccessed_nrds.bucket_id
  bucket_arn    = module.proccessed_nrds.bucket_arn
  lambda_arn    = module.test_result_report_fhir_validation_lambda.lambda_arn
  filter_prefix = "record_"
}

# Send Ack Message
module "send_ack_message_lambda" {
  source          = "./modules/lambda"
  environment     = var.environment
  bucket_id       = module.s3_bucket.bucket_id
  lambda_iam_role = module.iam_galleri_lambda_role.galleri_lambda_role_arn

  lambda_function_name = "sendAckMessageLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "send_ack_message_lambda.zip"
  environment_vars = {
    ENVIRONMENT                   = "${var.environment}"
    MESH_SANDBOX                  = "false"
    WORKFLOW_ID                   = "GRAIL_RESULT_ACK"
    MESH_URL                      = jsondecode(data.aws_secretsmanager_secret_version.mesh_url.secret_string)["MESH_URL"]
    MESH_SHARED_KEY               = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"]
    MESH_SENDER_MAILBOX_ID        = jsondecode(data.aws_secretsmanager_secret_version.nrds_mesh_mailbox_id.secret_string)["NRDS_MESH_MAILBOX_ID"]
    MESH_SENDER_MAILBOX_PASSWORD  = jsondecode(data.aws_secretsmanager_secret_version.nrds_mesh_mailbox_password.secret_string)["NRDS_MESH_MAILBOX_PASSWORD"]
    NRDS_MESH_RECEIVER_MAILBOX_ID = jsondecode(data.aws_secretsmanager_secret_version.nrds_mesh_receiver_mailbox_id.secret_string)["NRDS_MESH_RECEIVER_MAILBOX_ID"]
    TEST_RESULT_ACK_QUEUE_URL     = module.test_result_ack_queue_sqs.sqs_queue_url
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}
module "send_ack_message_SQS_trigger" {
  source           = "./modules/lambda_sqs_trigger"
  event_source_arn = module.test_result_ack_queue_sqs.sqs_queue_arn
  lambda_arn       = module.send_ack_message_lambda.lambda_arn
}

# Dynamodb tables
module "sdrs_table" {
  source      = "./modules/dynamodb"
  table_name  = "Sdrs"
  hash_key    = "NhsNumber"
  range_key   = "GivenName"
  environment = var.environment
  attributes = [{
    name = "NhsNumber"
    type = "N"
    },
    {
      name = "GivenName"
      type = "S"
    },
    {
      name = "TelephoneNumberMobile"
      type = "S"
    },
    {
      name = "EmailAddressHome"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name      = "EmailPhoneIndex"
      hash_key  = "EmailAddressHome"
      range_key = "TelephoneNumberMobile"
    }
  ]
  tags = {
    Name = "Dynamodb Table Sdrs"
  }
}

module "inbound_nrds_galleritestresult_step1_success" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step1-success"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step1_error" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step1-error"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step2_success" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step2-success"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step2_error" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step2-error"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}


module "inbound_nrds_galleritestresult_step3_success" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step3-success"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step3_error" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step3-error"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step4_success" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step4-success"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

module "inbound_nrds_galleritestresult_step4_error" {
  source                  = "./modules/s3"
  bucket_name             = "inbound-nrds-galleritestresult-step4-error"
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
  account_id              = var.account_id
}

#MESH keys

data "aws_secretsmanager_secret_version" "mesh_url" {
  secret_id = "MESH_URL"
}

data "aws_secretsmanager_secret_version" "mesh_shared_key" {
  secret_id = "MESH_SHARED_KEY_1"
}

data "aws_secretsmanager_secret_version" "mesh_sender_mailbox_id" {
  secret_id = "MESH_SENDER_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "mesh_sender_mailbox_password" {
  secret_id = "MESH_SENDER_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "mesh_receiver_mailbox_id" {
  secret_id = "MESH_RECEIVER_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "mesh_receiver_mailbox_password" {
  secret_id = "MESH_RECEIVER_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "gtms_mesh_mailbox_id" {
  secret_id = "GTMS_MESH_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "gtms_mesh_mailbox_password" {
  secret_id = "GTMS_MESH_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "caas_mesh_mailbox_id" {
  secret_id = "CAAS_MESH_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "caas_mesh_mailbox_password" {
  secret_id = "CAAS_MESH_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "gtms_mesh_receiver_mailbox_id" {
  secret_id = "GTMS_MESH_RECEIVER_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "sand_mesh_mailbox_id" {
  secret_id = "SAND_MESH_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "sand_mesh_mailbox_password" {
  secret_id = "SAND_MESH_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "nrds_mesh_mailbox_id" {
  secret_id = "NRDS_MESH_MAILBOX_ID"
}

data "aws_secretsmanager_secret_version" "nrds_mesh_mailbox_password" {
  secret_id = "NRDS_MESH_MAILBOX_PASSWORD"
}

data "aws_secretsmanager_secret_version" "nrds_mesh_receiver_mailbox_id" {
  secret_id = "NRDS_MESH_RECEIVER_MAILBOX_ID"
}

#END of MESH keys

module "validate_caas_feed_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "validateCaasFeedLambda"
  lambda_timeout       = 100
  memory_size          = 4096
  lambda_s3_object_key = "validate_caas_feed_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "validate_caas_feed_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.caas_data_bucket.bucket_id
  bucket_arn    = module.caas_data_bucket.bucket_arn
  lambda_arn    = module.validate_caas_feed_lambda.lambda_arn
  filter_prefix = "mesh_chunk_data_"
}

module "caas_feed_add_records_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "caasFeedAddRecordsLambda"
  lambda_timeout       = 180
  memory_size          = 2048
  lambda_s3_object_key = "caas_feed_add_records_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "caas_data_triggers" {
  source      = "./modules/lambda_s3_trigger"
  name        = "caas_data_trigger"
  bucket_arn  = module.validated_records_bucket.bucket_arn
  bucket_id   = module.validated_records_bucket.bucket_id
  environment = var.environment
  triggers = {
    add_records = {
      lambda_arn    = module.caas_feed_add_records_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_add-",
      filter_suffix = ""
    },
    update_records = {
      lambda_arn    = module.caas_feed_update_records_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_update-",
      filter_suffix = ""
    },
    delete_records = {
      lambda_arn = module.caas_feed_delete_records_lambda.lambda_arn,
      # bucket_events = ["s3:ObjectRemoved:*"],
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_delete-",
      filter_suffix = ""
    },
  }
}

module "caas_feed_update_records_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "caasFeedUpdateRecordsLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "caas_feed_update_records_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

# Dynamodb tables
module "participating_icb_table" {
  source      = "./modules/dynamodb"
  table_name  = "ParticipatingIcb"
  hash_key    = "IcbCode"
  environment = var.environment
  attributes = [{
    name = "IcbCode"
    type = "S"
    }
  ]
  tags = {
    Name = "Dynamodb Table Participating Icb"
  }
}

module "process_appointment_event_type_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "processAppointmentEventTypeLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "process_appointment_event_type_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
  sns_lambda_arn = module.sns_alert_lambda.lambda_arn
  sns_topic_arn  = module.sns_alert_lambda.sns_topic_arn
}

module "event_type_triggers" {
  name        = "event_type_triggers"
  source      = "./modules/lambda_s3_trigger"
  bucket_arn  = module.proccessed_appointments.bucket_arn
  bucket_id   = module.proccessed_appointments.bucket_id
  environment = var.environment
  triggers = {
    complete_event = {
      lambda_arn    = module.process_appointment_event_type_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_COMPLETE",
      filter_suffix = ""
    },
    cancelled_event = {
      lambda_arn    = module.appointments_event_cancelled_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_CANCELLED",
      filter_suffix = ""
    },
    booked_event = {
      lambda_arn    = module.gtms_appointment_event_booked_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_BOOKED",
      filter_suffix = ""
    }
  }
}

module "gp_practice_table" {
  source                   = "./modules/dynamodb"
  billing_mode             = "PAY_PER_REQUEST"
  table_name               = "GpPractice"
  hash_key                 = "gp_practice_code"
  environment              = var.environment
  read_capacity            = null
  write_capacity           = null
  secondary_write_capacity = null
  secondary_read_capacity  = null
  attributes = [{
    name = "gp_practice_code"
    type = "S"
    }
  ]
  tags = {
    Name = "Dynamodb Table Gp Practice"
  }
}

module "phlebotomy_site_table" {
  source      = "./modules/dynamodb"
  table_name  = "PhlebotomySite"
  hash_key    = "ClinicId"
  range_key   = "ClinicName"
  environment = var.environment
  attributes = [{
    name = "ClinicId"
    type = "S"
    },
    {
      name = "ClinicName"
      type = "S"
    },
    {
      name = "Postcode"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name      = "ClinicIdPostcodeIndex"
      hash_key  = "ClinicId"
      range_key = "Postcode"
    },
    {
      name               = "ClinicId-index"
      hash_key           = "ClinicId"
      range_key          = null,
      non_key_attributes = ["WeekCommencingDate"]
      projection_type    = "INCLUDE"
    },
  ]
  tags = {
    Name = "Dynamodb Table Phlebotomy Site"
  }
}

module "imd_table" {
  source      = "./modules/dynamodb"
  table_name  = "Imd"
  hash_key    = "LsoaCode"
  range_key   = "LsoaName"
  environment = var.environment
  attributes = [{
    name = "LsoaCode"
    type = "S"
    },
    {
      name = "LsoaName"
      type = "S"
    },
    {
      name = "ImdRank"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name      = "ImdRankImdDecileIndex"
      hash_key  = "ImdRank"
      range_key = "LsoaName"
    }
  ]
  tags = {
    Name = "Dynamodb Table Imd"
  }
}

module "postcode_table" {
  source                   = "./modules/dynamodb"
  billing_mode             = "PAY_PER_REQUEST"
  table_name               = "Postcode"
  hash_key                 = "POSTCODE"
  environment              = var.environment
  read_capacity            = null
  write_capacity           = null
  secondary_write_capacity = null
  secondary_read_capacity  = null
  attributes = [{
    name = "POSTCODE"
    type = "S"
    }
  ]
  tags = {
    Name = "Dynamodb Table Postcode"
  }
}

module "population_table" {
  source                   = "./modules/dynamodb"
  billing_mode             = "PAY_PER_REQUEST"
  stream_enabled           = true
  stream_view_type         = "NEW_AND_OLD_IMAGES"
  table_name               = "Population"
  hash_key                 = "PersonId"
  range_key                = "LsoaCode"
  read_capacity            = null
  write_capacity           = null
  secondary_write_capacity = null
  secondary_read_capacity  = null
  environment              = var.environment
  # non_key_attributes     = ["Invited", "date_of_death", "reason_for_removal_effective_from_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
  projection_type = "ALL"
  attributes = [{
    name = "PersonId"
    type = "S"
    },
    {
      name = "LsoaCode"
      type = "S"
    },
    {
      name = "Batch_Id"
      type = "S"
    },
    {
      name = "participantId"
      type = "S"
    },
    {
      name = "nhs_number"
      type = "N"
    },
    {
      name = "superseded_by_nhs_number"
      type = "N"
    }
  ]
  global_secondary_index = [
    {
      name               = "LsoaCode-index"
      hash_key           = "LsoaCode"
      range_key          = null
      non_key_attributes = ["Invited", "date_of_death", "reason_for_removal_effective_from_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
      projection_type    = "INCLUDE"
    },
    {
      name               = "BatchId-index"
      hash_key           = "Batch_Id"
      range_key          = null
      non_key_attributes = ["Invited", "date_of_death", "reason_for_removal_effective_from_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
      projection_type    = "INCLUDE"
    },
    {
      name            = "Participant_Id-index"
      hash_key        = "participantId"
      range_key       = null
      projection_type = "ALL"
    },
    {
      name            = "nhs_number-index"
      hash_key        = "nhs_number"
      range_key       = null
      projection_type = "ALL"
    },
    {
      name            = "superseded_by_nhs_number-index"
      hash_key        = "superseded_by_nhs_number"
      range_key       = null
      projection_type = "ALL"
    }
  ]
  tags = {
    Name = "Dynamodb Table Population"
  }
}

module "LSOA_table" {
  source                   = "./modules/dynamodb"
  billing_mode             = "PAY_PER_REQUEST"
  table_name               = "UniqueLsoa"
  hash_key                 = "LSOA_2011"
  range_key                = "IMD_RANK"
  environment              = var.environment
  read_capacity            = null
  write_capacity           = null
  secondary_write_capacity = null
  secondary_read_capacity  = null
  attributes = [{
    name = "LSOA_2011"
    type = "S"
    },
    {
      name = "IMD_RANK"
      type = "N"
    },
    {
      name = "IMD_DECILE"
      type = "N"
    }
  ]
  global_secondary_index = [
    {
      name      = "LSOA_2011"
      hash_key  = "IMD_RANK"
      range_key = "IMD_DECILE"
    }
  ]
  tags = {
    Name = "Dynamodb Table LSOA"
  }
}

module "invitation_parameters_table" {
  source      = "./modules/dynamodb"
  table_name  = "InvitationParameters"
  hash_key    = "CONFIG_ID"
  environment = var.environment
  attributes = [
    {
      name = "CONFIG_ID"
      type = "N"
    }
  ]
  tags = {
    Name = "Dynamodb Table Invitation Parameters"
  }
}

module "user_accounts_table" {
  source      = "./modules/dynamodb"
  table_name  = "UserAccounts"
  hash_key    = "User_UUID"
  environment = var.environment
  attributes = [
    {
      name = "User_UUID"
      type = "S"
    }
  ]
  tags = {
    Name = "Dynamodb Table User Accounts"
  }
}

# To be replaced with a script
resource "aws_dynamodb_table_item" "quintileTargets" {
  table_name = module.invitation_parameters_table.dynamodb_table_name
  hash_key   = module.invitation_parameters_table.dynamodb_hash_key
  //LAST_UPDATE will be used in a future story, meantime will act as placeholder
  item = <<ITEM
{
  "CONFIG_ID": {"N": "1"},
  "QUINTILE_1": {"N": "20"},
  "QUINTILE_2": {"N": "20"},
  "QUINTILE_3": {"N": "20"},
  "QUINTILE_4": {"N": "20"},
  "QUINTILE_5": {"N": "20"},
  "FORECAST_UPTAKE": {"N": "50"},
  "LAST_UPDATE": {"S": "2023-11-18 15:55:44.432942"}
}
ITEM
}

module "episode_table" {
  source                   = "./modules/dynamodb"
  billing_mode             = "PROVISIONED"
  stream_enabled           = true
  stream_view_type         = "NEW_AND_OLD_IMAGES"
  table_name               = "Episode"
  hash_key                 = "Batch_Id"
  range_key                = "Participant_Id"
  read_capacity            = 10
  write_capacity           = 10
  secondary_write_capacity = 10
  secondary_read_capacity  = 10
  environment              = var.environment
  projection_type          = "ALL"
  attributes = [
    {
      name = "Batch_Id"
      type = "S"
    },
    {
      name = "Participant_Id"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name      = "Participant_Id-index"
      hash_key  = "Participant_Id"
      range_key = null
    }
  ]
  tags = {
    Name = "Dynamodb Table Episode"
  }
}

module "episode_history_table" {
  source           = "./modules/dynamodb"
  billing_mode     = "PROVISIONED"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  table_name       = "EpisodeHistory"
  hash_key         = "Participant_Id"
  range_key        = "Episode_Event_Updated"
  read_capacity    = 10
  write_capacity   = 10
  environment      = var.environment

  attributes = [
    {
      name = "Participant_Id"
      type = "S"
    },
    {
      name = "Episode_Event_Updated"
      type = "S"
    }
  ]
  tags = {
    Name = "Dynamodb Table Episode History"
  }
}

module "appointment_table" {
  source          = "./modules/dynamodb"
  table_name      = "Appointments"
  hash_key        = "Participant_Id"
  range_key       = "Appointment_Id"
  environment     = var.environment
  projection_type = "ALL"
  attributes = [
    {
      name = "Participant_Id"
      type = "S"
    },
    {
      name = "Appointment_Id"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name            = "Appointment_Id-index"
      hash_key        = "Appointment_Id"
      range_key       = null
      projection_type = "ALL"
    }
  ]
  tags = {
    Name = "Dynamodb Table Appointments"
  }
}

module "galleri_blood_test_result_table" {
  source      = "./modules/dynamodb"
  table_name  = "GalleriBloodTestResult"
  hash_key    = "Participant_Id"
  range_key   = "Grail_Id"
  environment = var.environment
  attributes = [
    {
      name = "Participant_Id"
      type = "S"
    },
    {
      name = "Grail_Id"
      type = "S"
    }
  ]
  tags = {
    Name        = "Dynamodb Table Galleri Blood Test Result"
    Environment = var.environment
  }
}

module "caas_eventbridge_scheduler" {
  source              = "./modules/eventbridge_scheduler"
  function_name       = "pollMeshMailboxLambda"
  schedule_expression = "cron(0/30 * * * ? *)"
  lambda_arn          = module.poll_mesh_mailbox_lambda.lambda_arn
  environment         = var.environment
}

module "GTMS_eventbridge_scheduler" {
  source              = "./modules/eventbridge_scheduler"
  function_name       = "gtmsMeshMailboxLambda"
  schedule_expression = "cron(0/15 * * * ? *)"
  lambda_arn          = module.gtms_mesh_mailbox_lambda.lambda_arn
  environment         = var.environment
}


module "notify_send_message_status_table" {
  source         = "./modules/dynamodb"
  billing_mode   = "PROVISIONED"
  table_name     = "NotifySendMessageStatus"
  hash_key       = "Participant_Id"
  range_key      = "Message_Sent"
  read_capacity  = 10
  write_capacity = 10
  environment    = var.environment

  attributes = [
    {
      name = "Participant_Id"
      type = "S"
    },
    {
      name = "Message_Sent"
      type = "S"
    }
  ]
  tags = {
    Name        = "Dynamodb Table Notify Send Message Status"
    Environment = var.environment
  }
}

// Parameter Store
resource "aws_ssm_parameter" "invited-notify" {
  name      = "invited-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "invited-routing-id" {
  name      = "invited-routing-id"
  type      = "String"
  value     = "a91601f5-ed53-4472-bbaa-580f418c7091"
  overwrite = true
}

resource "aws_ssm_parameter" "invited-tables" {
  name      = "invited-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}

resource "aws_ssm_parameter" "withdrawn-notify" {
  name      = "withdrawn-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "withdrawn-routing-id" {
  name      = "withdrawn-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "withdrawn-tables" {
  name      = "withdrawn-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-letter-notify" {
  name      = "appointment-booked-letter-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-letter-routing-id" {
  name      = "appointment-booked-letter-routing-id"
  type      = "String"
  value     = "4c4c4c06-0f6d-465a-ab6a-ca358c2721b0"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-letter-tables" {
  name      = "appointment-booked-letter-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-text-notify" {
  name      = "appointment-booked-text-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-text-routing-id" {
  name      = "appointment-booked-text-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-booked-text-tables" {
  name      = "appointment-booked-text-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-letter-notify" {
  name      = "appointment-rebooked-letter-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-letter-routing-id" {
  name      = "appointment-rebooked-letter-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-letter-tables" {
  name      = "appointment-rebooked-letter-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-text-notify" {
  name      = "appointment-rebooked-text-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-text-routing-id" {
  name      = "appointment-rebooked-text-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-rebooked-text-tables" {
  name      = "appointment-rebooked-text-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-nhs-notify" {
  name      = "appointment-cancelled-by-nhs-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-nhs-routing-id" {
  name      = "appointment-cancelled-by-nhs-routing-id"
  type      = "String"
  value     = "841ebf60-4ffa-45d3-874b-b3e9db895c70"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-nhs-tables" {
  name      = "appointment-cancelled-by-nhs-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}
resource "aws_ssm_parameter" "appointment-cancelled-by-participant-notify" {
  name      = "appointment-cancelled-by-participant-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-participant-routing-id" {
  name      = "appointment-cancelled-by-participant-routing-id"
  type      = "String"
  value     = "841ebf60-4ffa-45d3-874b-b3e9db895c70"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-participant-tables" {
  name      = "appointment-cancelled-by-participant-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-participant-withdrawn-notify" {
  name      = "appointment-cancelled-by-participant-withdrawn-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-participant-withdrawn-routing-id" {
  name      = "appointment-cancelled-by-participant-withdrawn-routing-id"
  type      = "String"
  value     = "841ebf60-4ffa-45d3-874b-b3e9db895c70"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-cancelled-by-participant-withdrawn-tables" {
  name      = "appointment-cancelled-by-participant-withdrawn-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}


resource "aws_ssm_parameter" "appointment-attended-sample-taken-notify" {
  name      = "appointment-attended-sample-taken-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-attended-sample-taken-routing-id" {
  name      = "appointment-attended-sample-taken-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-attended-sample-taken-tables" {
  name      = "appointment-attended-sample-taken-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-not-attended-notify" {
  name      = "appointment-not-attended-notify"
  type      = "String"
  value     = "False"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-not-attended-routing-id" {
  name      = "appointment-not-attended-routing-id"
  type      = "String"
  value     = "N/A"
  overwrite = true
}

resource "aws_ssm_parameter" "appointment-not-attended-tables" {
  name      = "appointment-not-attended-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}

resource "aws_ssm_parameter" "result-no-csd-notify" {
  name      = "result-no-csd-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "result-no-csd-routing-id" {
  name      = "result-no-csd-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "result-no-csd-tables" {
  name      = "result-no-csd-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "result-cancelled-test-notify" {
  name      = "result-cancelled-test-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "result-cancelled-test-routing-id" {
  name      = "result-cancelled-test-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "result-cancelled-test-tables" {
  name      = "result-cancelled-test-tables"
  type      = "StringList"
  value     = "appointment, phlebotomy"
  overwrite = true
}

resource "aws_ssm_parameter" "referred-notify" {
  name      = "referred-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "referred-routing-id" {
  name      = "referred-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "referred-tables" {
  name      = "referred-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}
resource "aws_ssm_parameter" "consultation-call-no-consent-notify" {
  name      = "consultation-call-no-consent-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "consultation-call-no-consent-routing-id" {
  name      = "consultation-call-no-consent-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "consultation-call-no-consent-tables" {
  name      = "consultation-call-no-consent-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}
resource "aws_ssm_parameter" "unable-to-contact-csd-notify" {
  name      = "unable-to-contact-csd-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "unable-to-contact-csd-routing-id" {
  name      = "unable-to-contact-csd-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "unable-to-contact-csd--tables" {
  name      = "unable-to-contact-csd-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}
resource "aws_ssm_parameter" "private-referral-notify" {
  name      = "private-referral-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "private-referral-routing-id" {
  name      = "private-referral-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "private-referral-tables" {
  name      = "private-referral-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}
resource "aws_ssm_parameter" "contact-escalation-notify" {
  name      = "contact-escalation-notify"
  type      = "String"
  value     = "True"
  overwrite = true
}

resource "aws_ssm_parameter" "contact-escalation-routing-id" {
  name      = "contact-escalation-routing-id"
  type      = "String"
  value     = "Unavailable"
  overwrite = true
}

resource "aws_ssm_parameter" "contact-escalation-tables" {
  name      = "contact-escalation-tables"
  type      = "StringList"
  value     = "Null"
  overwrite = true
}

module "fhir_cert" {
  source        = "./modules/route_53"
  count         = var.route53_count > 0 ? 1 : 0
  environment   = var.environment
  region        = var.region
  dns_zone      = var.dns_zone
  hostname      = var.invitations_hostname
  alias_name    = var.alias_name
  alias_zone_id = var.alias_zone_id
}

resource "null_resource" "deploy_manifests" {
  # Trigger deployment after EKS is ready
  depends_on = [module.eks]

  provisioner "local-exec" {
    command = "aws eks update-kubeconfig --name ${var.environment}-eks-cluster && kubectl apply -f ../scripts/test_data/k8s/mesh-sandbox.yaml && kubectl apply -f ../scripts/test_data/k8s/fhir-validation.yaml"
  }
}
