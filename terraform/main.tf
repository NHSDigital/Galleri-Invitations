terraform {
  backend "s3" {
    dynamodb_table = "terraform-state-lock-dynamo"
    encrypt        = true
  }
}

provider "aws" {
  region = "eu-west-2"
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
  NEXT_PUBLIC_GET_USER_ROLE                             = module.get_user_role_api_gateway.rest_api_galleri_id
  NEXT_PUBLIC_CIS2_SIGNED_JWT                           = module.cis2_signed_jwt_api_gateway.rest_api_galleri_id
  USERS                                                 = var.USERS
  CIS2_ID                                               = var.CIS2_ID
  NEXTAUTH_URL                                          = var.NEXTAUTH_URL
  GALLERI_ACTIVITY_CODE                                 = var.GALLERI_ACTIVITY_CODE
  GALLERI_ACTIVITY_NAME                                 = var.GALLERI_ACTIVITY_NAME
  hostname                                              = var.invitations-hostname
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
    instance_types = ["t3.medium"]
  }

  eks_managed_node_groups = {
    example = {
      min_size     = 1
      max_size     = 3
      desired_size = 2

      instance_types = ["t3.large"]
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
      principal_arn     = "arn:aws:iam::136293001324:role/aws-reserved/sso.amazonaws.com/eu-west-2/AWSReservedSSO_Admin_603cb786ef89bc37"

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

  tags = {
    Environment = var.environment
    Terraform   = "true"
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
  environment_vars = {
    BUCKET_NAME     = "galleri-ons-data",
    GRIDALL_CHUNK_1 = "gridall/chunk_data/chunk_1.csv",
    GRIDALL_CHUNK_2 = "gridall/chunk_data/chunk_2.csv",
    GRIDALL_CHUNK_3 = "gridall/chunk_data/chunk_3.csv",
    ENVIRONMENT     = "${var.environment}"
  }
}

module "data_filter_gridall_imd_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.data_filter_gridall_imd_lambda.lambda_function_name
  retention_days       = 14
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
}

module "lsoa_loader_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.lsoa_loader_lambda.lambda_function_name
  retention_days       = 14
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
}

module "clinic_information_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.clinic_information_lambda.lambda_function_name
  retention_days       = 14
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
}

module "clinic_icb_list_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.clinic_icb_list_lambda.lambda_function_name
  retention_days       = 14
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
}

module "participating_icb_list_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.participating_icb_list_lambda.lambda_function_name
  retention_days       = 14
}

module "participating_icb_list_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.participating_icb_list_lambda.lambda_invoke_arn
  path_part              = "participating-icb-list"
  method_http_parameters = {}
  lambda_function_name   = module.participating_icb_list_lambda.lambda_function_name
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
}

module "clinic_summary_list_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.clinic_summary_list_lambda.lambda_function_name
  retention_days       = 14
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
}

module "invitation_parameters_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.invitation_parameters_lambda.lambda_function_name
  retention_days       = 14
}

module "invitation_parameters_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.invitation_parameters_lambda.lambda_invoke_arn
  path_part              = "invitation-parameters"
  method_http_parameters = {}
  lambda_function_name   = module.invitation_parameters_lambda.lambda_function_name
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
}

module "invitation_parameters_put_forecast_uptake_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.invitation_parameters_put_forecast_uptake_lambda.lambda_function_name
  retention_days       = 14
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
}

module "invitation_parameters_put_quintiles_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.invitation_parameters_put_quintiles_lambda.lambda_function_name
  retention_days       = 14
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
}

module "target_fill_to_percentage_put_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.target_fill_to_percentage_put_lambda.lambda_function_name
  retention_days       = 14
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
}

module "target_fill_to_percentage_get_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.target_fill_to_percentage_get_lambda.lambda_function_name
  retention_days       = 14
}

module "target_fill_to_percentage_get_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.target_fill_to_percentage_get_lambda.lambda_invoke_arn
  path_part              = "target-percentage"
  method_http_parameters = {}
  lambda_function_name   = module.target_fill_to_percentage_get_lambda.lambda_function_name
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
}

module "lsoa_in_range_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.lsoa_in_range_lambda.lambda_function_name
  retention_days       = 14
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
}

module "participants_in_lsoa_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.participants_in_lsoa_lambda.lambda_function_name
  retention_days       = 14
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
}

module "calculate_number_to_invite_cloudwatch" {
  source               = "./modules/cloudwatch"
  lambda_function_name = module.calculate_number_to_invite_lambda.lambda_function_name
  environment          = var.environment
  retention_days       = 14
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
}

module "generate_invites_cloudwatch" {
  source               = "./modules/cloudwatch"
  lambda_function_name = module.generate_invites_lambda.lambda_function_name
  environment          = var.environment
  retention_days       = 14
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
}

module "gp_practices_loader_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gp_practices_loader_lambda.lambda_function_name
  retention_days       = 14
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
}

module "create_episode_record_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.create_episode_record_lambda.lambda_function_name
  retention_days       = 14
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
}

module "add_episode_history_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.add_episode_history_lambda.lambda_function_name
  retention_days       = 14
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
}

module "appointments_event_cancelled_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.appointments_event_cancelled_lambda.lambda_function_name
  retention_days       = 14
}

module "appointments_event_cancelled_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.proccessed_appointments.bucket_id
  bucket_arn    = module.proccessed_appointments.bucket_arn
  lambda_arn    = module.appointments_event_cancelled_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records-"
}

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
}

module "user_accounts_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.user_accounts_lambda.lambda_function_name
  retention_days       = 14
}

module "user_accounts_lambda_trigger" {
  source     = "./modules/lambda_trigger"
  bucket_id  = module.user_accounts_bucket.bucket_id
  bucket_arn = module.user_accounts_bucket.bucket_arn
  lambda_arn = module.user_accounts_lambda.lambda_arn
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
}

module "gtms_status_update_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gtms_status_update_lambda.lambda_function_name
  retention_days       = 14
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
}

module "validate_gtms_withdrawal_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_gtms_withdrawal_lambda.lambda_function_name
  retention_days       = 14
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
  }
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
}

module "validate_gtms_appointment_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_gtms_appointment_lambda.lambda_function_name
  retention_days       = 14
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
}

module "validate_appointment_common_data_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_appointment_common_data_lambda.lambda_function_name
  retention_days       = 14
}

module "validate_appointment_common_data_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.gtms_appointment_validated.bucket_id
  bucket_arn    = module.gtms_appointment_validated.bucket_arn
  lambda_arn    = module.validate_appointment_common_data_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records_add-"
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
}

module "create_invitation_batch_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.create_invitation_batch_lambda.lambda_function_name
  retention_days       = 14
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
}

module "gtms_mesh_mailbox_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gtms_mesh_mailbox_lambda.lambda_function_name
  retention_days       = 14
}

# Get User Role Lambda
module "get_user_role_lambda" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "getUserRoleLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "get_user_role_lambda.zip"
  environment_vars = {
    ENVIRONMENT = "${var.environment}"
  }
}

module "get_user_role_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.get_user_role_lambda.lambda_function_name
  retention_days       = 14
}
module "get_user_role_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.get_user_role_lambda.lambda_invoke_arn
  path_part              = "get-user-role"
  method_http_parameters = {}
  lambda_function_name   = module.get_user_role_lambda.lambda_function_name
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
}

module "validate_clinic_data_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_clinic_data_lambda.lambda_function_name
  retention_days       = 14
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
}

module "gtms_upload_clinic_data_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gtms_upload_clinic_data_lambda.lambda_function_name
  retention_days       = 14
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
}

module "gps_jwks_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gps_jwks_lambda.lambda_function_name
  retention_days       = 14
}

module "gps_jwks_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.gps_jwks_lambda.lambda_invoke_arn
  path_part              = "gps-jwks"
  method_http_parameters = {}
  lambda_function_name   = module.gps_jwks_lambda.lambda_function_name
}

# CIS2 signed jwt
module "cis2_signed_jwt" {
  source               = "./modules/lambda"
  environment          = var.environment
  bucket_id            = module.s3_bucket.bucket_id
  lambda_iam_role      = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  lambda_function_name = "cis2SignedJwtLambda"
  lambda_timeout       = 100
  memory_size          = 1024
  lambda_s3_object_key = "cis2_signed_jwt_lambda.zip"
  environment_vars = {
    ENVIRONMENT             = "${var.environment}",
    CIS2_ID                 = "${var.CIS2_ID}",
    CIS2_TOKEN_ENDPOINT_URL = "${var.CIS2_TOKEN_ENDPOINT_URL}",
    CIS2_PUBLIC_KEY_ID      = "${var.CIS2_PUBLIC_KEY_ID}",
    CIS2_KEY_NAME           = "${var.CIS2_KNAME}"
  }
}

module "cis2_signed_jwt_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.cis2_signed_jwt.lambda_function_name
  retention_days       = 14
}

module "cis2_signed_jwt_api_gateway" {
  source                 = "./modules/api-gateway"
  environment            = var.environment
  lambda_invoke_arn      = module.cis2_signed_jwt.lambda_invoke_arn
  path_part              = "cis2-signed-jwt"
  method_http_parameters = {}
  lambda_function_name   = module.cis2_signed_jwt.lambda_function_name
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
}

module "validate_clinic_capacity_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_clinic_capacity_lambda.lambda_function_name
  retention_days       = 14
}


module "validate_clinic_capacity_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.clinic_schedule_summary.bucket_id
  bucket_arn    = module.clinic_schedule_summary.bucket_arn
  lambda_arn    = module.validate_clinic_capacity_lambda.lambda_arn
  filter_prefix = "clinic-schedule-summary"
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
}

module "gtms_upload_clinic_capacity_data_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.gtms_upload_clinic_capacity_data_lambda.lambda_function_name
  retention_days       = 14
}

module "gtms_upload_clinic_capacity_data_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.processed_clinic_schedule_summary_bucket.bucket_id
  bucket_arn    = module.processed_clinic_schedule_summary_bucket.bucket_arn
  lambda_arn    = module.gtms_upload_clinic_capacity_data_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records_add-"
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
    ENVIRONMENT                    = "${var.environment}",
    MESH_SANDBOX                   = "false",
    WORKFLOW_ID                    = "API-GTMS-INVITATION-BATCH-TEST",
    MESH_URL                       = jsondecode(data.aws_secretsmanager_secret_version.mesh_url.secret_string)["MESH_URL"],
    MESH_SHARED_KEY                = jsondecode(data.aws_secretsmanager_secret_version.mesh_shared_key.secret_string)["MESH_SHARED_KEY"],
    MESH_SENDER_MAILBOX_ID         = jsondecode(data.aws_secretsmanager_secret_version.mesh_sender_mailbox_id.secret_string)["MESH_SENDER_MAILBOX_ID"],
    MESH_SENDER_MAILBOX_PASSWORD   = jsondecode(data.aws_secretsmanager_secret_version.mesh_sender_mailbox_password.secret_string)["MESH_SENDER_MAILBOX_PASSWORD"],
    MESH_RECEIVER_MAILBOX_ID       = jsondecode(data.aws_secretsmanager_secret_version.mesh_receiver_mailbox_id.secret_string)["MESH_RECEIVER_MAILBOX_ID"],
    MESH_RECEIVER_MAILBOX_PASSWORD = jsondecode(data.aws_secretsmanager_secret_version.mesh_receiver_mailbox_password.secret_string)["MESH_RECEIVER_MAILBOX_PASSWORD"]
  }
}

module "send_GTMS_invitation_batch_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.send_GTMS_invitation_batch_lambda.lambda_function_name
  retention_days       = 14
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
}

module "send_invitation_batch_to_raw_message_queue_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.send_invitation_batch_to_raw_message_queue_lambda.lambda_function_name
  retention_days       = 14
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
}

module "caas_feed_delete_records_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.caas_feed_delete_records_lambda.lambda_function_name
  retention_days       = 14
}
# trigger replaced by group trigger for bucket

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
    Name        = "Dynamodb Table Sdrs"
    Environment = var.environment
  }
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
#END of MESH keys

module "poll_mesh_mailbox_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.poll_mesh_mailbox_lambda.lambda_function_name
  retention_days       = 14
}

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
}

module "validate_caas_feed_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.validate_caas_feed_lambda.lambda_function_name
  retention_days       = 14
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
}

module "caas_feed_add_records_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.caas_feed_add_records_lambda.lambda_function_name
  retention_days       = 14
}

module "caas_data_triggers" {
  name       = "caas_data_trigger"
  source     = "./modules/lambda_s3_trigger"
  bucket_arn = module.validated_records_bucket.bucket_arn
  bucket_id  = module.validated_records_bucket.bucket_id
  triggers = [
    {
      lambda_arn    = module.caas_feed_add_records_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_add-",
      filter_suffix = null
    },
    {
      lambda_arn    = module.caas_feed_update_records_lambda.lambda_arn,
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_update-",
      filter_suffix = null
    },
    {
      lambda_arn = module.caas_feed_delete_records_lambda.lambda_arn,
      # bucket_events = ["s3:ObjectRemoved:*"],
      bucket_events = ["s3:ObjectCreated:*"],
      filter_prefix = "validRecords/valid_records_delete-",
      filter_suffix = null
    }
  ]
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
}

module "caas_feed_update_records_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.caas_feed_update_records_lambda.lambda_function_name
  retention_days       = 14
}
# trigger replaced by group trigger for bucket

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
    Name        = "Dynamodb Table Participating Icb"
    Environment = var.environment
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
}

module "process_appointment_event_type_lambda_cloudwatch" {
  source               = "./modules/cloudwatch"
  environment          = var.environment
  lambda_function_name = module.process_appointment_event_type_lambda.lambda_function_name
  retention_days       = 14
}

module "process_appointment_event_type_lambda_trigger" {
  source        = "./modules/lambda_trigger"
  bucket_id     = module.proccessed_appointments.bucket_id
  bucket_arn    = module.proccessed_appointments.bucket_arn
  lambda_arn    = module.process_appointment_event_type_lambda.lambda_arn
  filter_prefix = "validRecords/valid_records-"
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
    Name        = "Dynamodb Table Gp Practice"
    Environment = var.environment
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
    Name        = "Dynamodb Table Phlebotomy Site"
    Environment = var.environment
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
    Name        = "Dynamodb Table Imd"
    Environment = var.environment
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
    Name        = "Dynamodb Table Postcode"
    Environment = var.environment
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
  # non_key_attributes     = ["Invited", "date_of_death", "removal_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
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
      non_key_attributes = ["Invited", "date_of_death", "removal_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
      projection_type    = "INCLUDE"
    },
    {
      name               = "BatchId-index"
      hash_key           = "Batch_Id"
      range_key          = null
      non_key_attributes = ["Invited", "date_of_death", "removal_date", "identified_to_be_invited", "LsoaCode", "postcode", "PersonId", "primary_care_provider"]
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
    Name        = "Dynamodb Table Population"
    Environment = var.environment
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
    Name        = "Dynamodb Table LSOA"
    Environment = var.environment
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
    Name        = "Dynamodb Table Invitation Parameters"
    Environment = var.environment
  }
}

module "user_accounts_table" {
  source      = "./modules/dynamodb"
  table_name  = "UserAccounts"
  hash_key    = "UUID"
  environment = var.environment
  attributes = [
    {
      name = "UUID"
      type = "S"
    }
  ]
  tags = {
    Name        = "Dynamodb Table User Accounts"
    Environment = var.environment
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
    Name        = "Dynamodb Table Episode"
    Environment = var.environment
  }
}

module "episode_history_table" {
  source           = "./modules/dynamodb"
  billing_mode     = "PROVISIONED"
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
  table_name       = "EpisodeHistory"
  hash_key         = "Participant_Id"
  read_capacity    = 10
  write_capacity   = 10
  environment      = var.environment

  attributes = [
    {
      name = "Participant_Id"
      type = "S"
    }
  ]
  tags = {
    Name        = "Dynamodb Table Episode History"
    Environment = var.environment
  }
}

module "appointment_table" {
  source      = "./modules/dynamodb"
  table_name  = "Appointments"
  hash_key    = "Participant_Id"
  range_key   = "Appointment_Id"
  environment = var.environment
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
      name      = "Appointment_Id-index"
      hash_key  = "Appointment_Id"
      range_key = null
    }
  ]
  tags = {
    Name        = "Dynamodb Table Appointments"
    Environment = var.environment
  }
}
