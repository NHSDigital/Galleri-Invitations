terraform {
  backend "s3" {
    bucket         = "galleri-github-oidc-tf-aws-tfstates"
    key            = "infra.tfstate"
    region         = "eu-west-2"
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
  source                 = "./modules/elastic_beanstalk"
  name                   = "gallery-invitations"
  description            = "The frontend for interacting with the invitations system"
  frontend_repo_location = var.frontend_repo_location
  environment            = var.environment
  vpc_id                 = module.vpc.vpc_id
  subnet_1               = module.vpc.subnet_ids[0]
  subnet_2               = module.vpc.subnet_ids[1]
}

# the role that all lambda's are utilising,
# we will replace this with individual roles in a future ticket
module "iam_galleri_lambda_role" {
  source      = "./modules/iam_galleri_role"
  role_name   = var.role_name
  environment = var.environment
}

module "s3_bucket" {
  source                  = "./modules/s3"
  bucket_name             = var.bucket_name
  galleri_lambda_role_arn = module.iam_galleri_lambda_role.galleri_lambda_role_arn
  environment             = var.environment
}


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
    environment     = "${var.environment}"
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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


# partisipating icb list
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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
  lambda_invoke_arn         = module.invitation_parameters_lambda.lambda_invoke_arn
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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
    environment = "${var.environment}"
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

module "gp_practice_table" {
  source      = "./modules/dynamodb"
  table_name  = "GpPractice"
  hash_key    = "GpPracticeId"
  range_key   = "GpPracticeName"
  environment = var.environment
  attributes = [{
    name = "GpPracticeId"
    type = "S"
    },
    {
      name = "GpPracticeName"
      type = "S"
    },
    {
      name = "AddressLine1"
      type = "S"
    },
    {
      name = "Postcode"
      type = "S"
    }
  ]
  global_secondary_index = [
    {
      name      = "AddressLine1PostcodeIndex"
      hash_key  = "AddressLine1"
      range_key = "Postcode"
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
    }
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

module "population_table" {
  source      = "./modules/dynamodb"
  table_name  = "Population"
  hash_key    = "PersonId"
  range_key   = "LsoaCode"
  environment = var.environment
  attributes = [{
    name = "PersonId"
    type = "S"
    },
    {
      name = "LsoaCode"
      type = "N"
    },
    {
      name = "NhsNumber"
      type = "N"
    }
  ]
  global_secondary_index = [
    {
      name      = "PersonId"
      hash_key  = "NhsNumber"
      range_key = "LsoaCode"
    }
  ]
  tags = {
    Name        = "Dynamodb Table Population"
    Environment = var.environment
  }
}

module "LSOA_table" {
  source         = "./modules/dynamodb"
  billing_mode   = "PAY_PER_REQUEST"
  table_name     = "UniqueLsoa"
  hash_key       = "LSOA_2011"
  range_key      = "IMD_RANK"
  environment    = var.environment
  read_capacity  = null
  write_capacity = null
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

# To be replaced with a script
resource "aws_dynamodb_table_item" "quintileTargets" {
  table_name = module.invitation_parameters_table.dynamodb_table_name
  hash_key   = module.invitation_parameters_table.dynamodb_hash_key

  item = <<ITEM
{
  "CONFIG_ID": {"N": "1"},
  "QUINTILE_1": {"N": "20"},
  "QUINTILE_2": {"N": "20"},
  "QUINTILE_3": {"N": "20"},
  "QUINTILE_4": {"N": "20"},
  "QUINTILE_5": {"N": "20"},
  "FORECAST_UPTAKE": {"N": "50"}
}
ITEM
}
