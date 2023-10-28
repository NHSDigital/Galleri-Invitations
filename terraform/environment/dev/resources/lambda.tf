resource "aws_s3_bucket" "galleri_lambda_bucket" {
  bucket        = "galleri-lambda-bucket"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "galleri_lambda_bucket_block_public_access" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_iam_role" "galleri_lambda_role" {
  name = "galleri-lambda-role"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_policy" "iam_policy_for_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowS3Access",
      "Effect": "Allow",
      "Action": [
        "s3:*"
      ],
      "Resource": [
        "arn:aws:s3:::galleri-ons-data"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_clinic_information_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_clinic_information_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda clinic details role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/PhlebotomySite"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_participating_icb_list_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_participating_icb_list_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda participating icb role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/ParticipatingIcb"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_clinic_summary_list_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_clinic_summary_list_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda clinic summary role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/PhlebotomySite"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_invitation_parameters_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_invitation_parameters_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda invitation parameter role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/InvitationParameters"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_lsoa_in_range_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_lsoa_in_range_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda get lsoa in range role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/UniqueLsoa"
      ]
    },
    {
      "Sid": "AllowLambdaInvoke",
      "Effect": "Allow",
      "Action": [
        "lambda:*"
      ],
      "Resource": [
        "arn:aws:lambda:eu-west-2:136293001324:function:getLsoaParticipantsLambda"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_policy" "iam_policy_for_participants_in_lsoa_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_participants_in_lsoa_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda get participants in lsoa role"
  policy      = <<EOF
{
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Effect": "Allow",
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Sid": "AllowDynamodbAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:*"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:136293001324:table/Population/*/*"
      ]
    }
  ],
  "Version": "2012-10-17"
}
EOF
}

resource "aws_iam_role_policy_attachment" "galleri_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_lambda.arn
}

resource "aws_iam_role_policy_attachment" "clinic_information_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_clinic_information_lambda.arn
}

resource "aws_iam_role_policy_attachment" "participating_icb_list_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_participating_icb_list_lambda.arn
}

resource "aws_iam_role_policy_attachment" "clinic_summary_list_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_clinic_summary_list_lambda.arn
}

resource "aws_iam_role_policy_attachment" "invitation_parameters_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_invitation_parameters_lambda.arn
}

resource "aws_iam_role_policy_attachment" "lsoa_in_range_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_lsoa_in_range_lambda.arn
}

resource "aws_iam_role_policy_attachment" "participants_in_lsoa_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_participants_in_lsoa_lambda.arn
}

// Zip lambda folders
data "archive_file" "data_filter_gridall_imd_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/filterData/lambdaHandler"
  output_path = "${path.cwd}/lambda/filterData/lambdaHandler/dataFilterLambda.zip"
}

data "archive_file" "data_non_prod_lsoa_loader_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/lsoaLoader/lambdaHandler"
  output_path = "${path.cwd}/lambda/lsoaLoader/lambdaHandler/lsoaLoaderLambda.zip"
}

data "archive_file" "clinic_information_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/clinicInformation/lambdaHandler"
  output_path = "${path.cwd}/lambda/clinicInformation/lambdaHandler/clinicInformationLambda.zip"
}

data "archive_file" "clinic_icb_list_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/clinicIcbList/lambdaHandler"
  output_path = "${path.cwd}/lambda/clinicIcbList/lambdaHandler/clinicIcbListLambda.zip"
}

data "archive_file" "participating_icb_list_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/participatingIcbList/lambdaHandler"
  output_path = "${path.cwd}/lambda/participatingIcbList/lambdaHandler/participatingIcbListLambda.zip"
}

data "archive_file" "clinic_summary_list_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/clinicSummaryList/lambdaHandler"
  output_path = "${path.cwd}/lambda/clinicSummaryList/lambdaHandler/clinicSummaryListLambda.zip"
}

data "archive_file" "invitation_parameters_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/invitationParameters/lambdaHandler"
  output_path = "${path.cwd}/lambda/invitationParameters/lambdaHandler/invitationParametersLambda.zip"
}

data "archive_file" "invitation_parameters_put_forecast_uptake_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/invitationParametersPutForecastUptake/lambdaHandler"
  output_path = "${path.cwd}/lambda/invitationParametersPutForecastUptake/lambdaHandler/invitationParametersPutForecastUptakeLambda.zip"
}

data "archive_file" "invitation_parameters_put_quintiles_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/invitationParametersPutQuintiles/lambdaHandler"
  output_path = "${path.cwd}/lambda/invitationParametersPutQuintiles/lambdaHandler/invitationParametersPutQuintilesLambda.zip"
}

data "archive_file" "target_fill_to_percentage_put_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/targetFillToPercentagePut/lambdaHandler"
  output_path = "${path.cwd}/lambda/targetFillToPercentagePut/lambdaHandler/targetFillToPercentagePutLambda.zip"
}

data "archive_file" "target_fill_to_percentage_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/targetFillToPercentage/lambdaHandler"
  output_path = "${path.cwd}/lambda/targetFillToPercentage/lambdaHandler/targetFillToPercentageLambda.zip"
}
data "archive_file" "lsoa_in_range_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/getLsoaInRange/lambdaHandler"
  output_path = "${path.cwd}/lambda/getLsoaInRange/lambdaHandler/getLsoaInRangeLambda.zip"
}

data "archive_file" "participants_in_lsoa_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/getLsoaParticipants/lambdaHandler"
  output_path = "${path.cwd}/lambda/getLsoaParticipants/lambdaHandler/getLsoaParticipantsLambda.zip"
}

// Create lambda functions
resource "aws_lambda_function" "data_filter_gridall_imd" {
  function_name = "dataFilterLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "dataFilterLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 900
  memory_size   = 4096


  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.data_filter_gridall_imd_lambda.key

  source_code_hash = data.archive_file.data_filter_gridall_imd_lambda.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME     = "galleri-ons-data",
      GRIDALL_CHUNK_1 = "gridall/chunk_data/chunk_1.csv",
      GRIDALL_CHUNK_2 = "gridall/chunk_data/chunk_2.csv",
      GRIDALL_CHUNK_3 = "gridall/chunk_data/chunk_3.csv"
    }
  }
}

resource "aws_lambda_function" "non_prod_lsoa_loader" {
  function_name = "lsoaLoaderLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "lsoaLoaderLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 900
  memory_size   = 2048


  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.non_prod_lsoa_loader_lambda.key

  source_code_hash = data.archive_file.data_non_prod_lsoa_loader_lambda.output_base64sha256

  environment {
    variables = {
      BUCKET_NAME = "galleri-ons-data",
      KEY         = "lsoa_data/lsoa_data_2023-08-15T15:42:13.301Z.csv"
    }
  }
}

resource "aws_lambda_function" "clinic_information" {
  function_name = "clinicInformationLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "clinicInformationLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.clinic_information_lambda.key

  source_code_hash = data.archive_file.clinic_information_lambda.output_base64sha256

}

resource "aws_lambda_function" "clinic_icb_list" {
  function_name = "clinicIcbListLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "clinicIcbListLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.clinic_icb_list_lambda.key

  source_code_hash = data.archive_file.clinic_icb_list_lambda.output_base64sha256

}

resource "aws_lambda_function" "participating_icb_list" {
  function_name = "participatingIcbListLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "participatingIcbListLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id

  s3_key = aws_s3_object.participating_icb_list_lambda.key

  source_code_hash = data.archive_file.participating_icb_list_lambda.output_base64sha256

}

resource "aws_lambda_function" "clinic_summary_list" {
  function_name = "clinicSummaryListLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "clinicSummaryListLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.clinic_summary_list_lambda.key

  source_code_hash = data.archive_file.clinic_summary_list_lambda.output_base64sha256

}

resource "aws_lambda_function" "invitation_parameters" {
  function_name = "invitationParametersLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "invitationParametersLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.invitation_parameters_lambda.key

  source_code_hash = data.archive_file.invitation_parameters_lambda.output_base64sha256

}

resource "aws_lambda_function" "invitation_parameters_put_forecast_uptake" {
  function_name = "invitationParametersPutForecastUptakeLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "invitationParametersPutForecastUptakeLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.invitation_parameters_put_forecast_uptake_lambda.key // may need to change

  source_code_hash = data.archive_file.invitation_parameters_put_forecast_uptake_lambda.output_base64sha256

}

resource "aws_lambda_function" "invitation_parameters_put_quintiles" {
  function_name = "invitationParametersPutQuintilesLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "invitationParametersPutQuintilesLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.invitation_parameters_put_quintiles_lambda.key // may need to change

  source_code_hash = data.archive_file.invitation_parameters_put_quintiles_lambda.output_base64sha256

}

resource "aws_lambda_function" "target_fill_to_percentage_put" {
  function_name = "targetFillToPercentagePutLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "targetFillToPercentagePutLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.target_fill_to_percentage_put_lambda.key

  source_code_hash = data.archive_file.target_fill_to_percentage_put_lambda.output_base64sha256

}

resource "aws_lambda_function" "get_target_fill_to_percentage" {
  function_name = "targetFillToPercentageLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "targetFillToPercentageLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.target_fill_to_percentage_lambda.key

  source_code_hash = data.archive_file.target_fill_to_percentage_lambda.output_base64sha256

}

resource "aws_lambda_function" "lsoa_in_range" {
  function_name = "getLsoaInRangeLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "getLsoaInRangeLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.lsoa_in_range_lambda.key // may need to change

  source_code_hash = data.archive_file.lsoa_in_range_lambda.output_base64sha256

}

resource "aws_lambda_function" "participants_in_lsoa" {
  function_name = "getLsoaParticipantsLambda"
  role          = aws_iam_role.galleri_lambda_role.arn
  handler       = "getLsoaParticipantsLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.participants_in_lsoa_lambda.key // may need to change

  source_code_hash = data.archive_file.participants_in_lsoa_lambda.output_base64sha256

}

// Create cloudwatch log group
resource "aws_cloudwatch_log_group" "data_filter_gridall_imd" {
  name = "/aws/lambda/${aws_lambda_function.data_filter_gridall_imd.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "non_prod_lsoa_loader" {
  name = "/aws/lambda/${aws_lambda_function.non_prod_lsoa_loader.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "clinic_information" {
  name = "/aws/lambda/${aws_lambda_function.clinic_information.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "clinic_icb_list" {
  name = "/aws/lambda/${aws_lambda_function.clinic_icb_list.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "participating_icb_list" {
  name = "/aws/lambda/${aws_lambda_function.participating_icb_list.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "clinic_summary_list" {
  name = "/aws/lambda/${aws_lambda_function.clinic_summary_list.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "invitation_parameters" {
  name = "/aws/lambda/${aws_lambda_function.invitation_parameters.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "invitation_parameters_put_forecast_uptake" {
  name = "/aws/lambda/${aws_lambda_function.invitation_parameters_put_forecast_uptake.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "invitation_parameters_put_quintiles" {
  name = "/aws/lambda/${aws_lambda_function.invitation_parameters_put_quintiles.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "target_fill_to_percentage_put" {
  name = "/aws/lambda/${aws_lambda_function.target_fill_to_percentage_put.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "get_target_fill_to_percentage" {
  name = "/aws/lambda/${aws_lambda_function.get_target_fill_to_percentage.function_name}"

  retention_in_days = 14
}
resource "aws_cloudwatch_log_group" "lsoa_in_range" {
  name = "/aws/lambda/${aws_lambda_function.lsoa_in_range.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "participants_in_lsoa" {
  name = "/aws/lambda/${aws_lambda_function.participants_in_lsoa.function_name}"

  retention_in_days = 14
}

// Create s3 object
resource "aws_s3_object" "data_filter_gridall_imd_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "data_filter_gridall_imd.zip"
  source = data.archive_file.data_filter_gridall_imd_lambda.output_path

  etag = filemd5(data.archive_file.data_filter_gridall_imd_lambda.output_path)
}

resource "aws_s3_object" "non_prod_lsoa_loader_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "non_prod_lsoa_loader.zip"
  source = data.archive_file.data_non_prod_lsoa_loader_lambda.output_path

  etag = filemd5(data.archive_file.data_non_prod_lsoa_loader_lambda.output_path)
}

resource "aws_s3_object" "clinic_information_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "clinic_information_lambda.zip"
  source = data.archive_file.clinic_information_lambda.output_path

  etag = filemd5(data.archive_file.clinic_information_lambda.output_path)
}

resource "aws_s3_object" "clinic_icb_list_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "clinic_icb_list_lambda.zip"
  source = data.archive_file.clinic_icb_list_lambda.output_path

  etag = filemd5(data.archive_file.clinic_icb_list_lambda.output_path)
}

resource "aws_s3_object" "participating_icb_list_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "participating_icb_list_lambda.zip"
  source = data.archive_file.participating_icb_list_lambda.output_path

  etag = filemd5(data.archive_file.participating_icb_list_lambda.output_path)
}

resource "aws_s3_object" "clinic_summary_list_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "clinic_summary_list_lambda.zip"
  source = data.archive_file.clinic_summary_list_lambda.output_path

  etag = filemd5(data.archive_file.clinic_summary_list_lambda.output_path)
}

resource "aws_s3_object" "invitation_parameters_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "invitation_parameters_lambda.zip"
  source = data.archive_file.invitation_parameters_lambda.output_path

  etag = filemd5(data.archive_file.invitation_parameters_lambda.output_path)
}

resource "aws_s3_object" "invitation_parameters_put_forecast_uptake_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "invitation_parameters_put_forecast_uptake_lambda.zip"
  source = data.archive_file.invitation_parameters_put_forecast_uptake_lambda.output_path

  etag = filemd5(data.archive_file.invitation_parameters_put_forecast_uptake_lambda.output_path)
}

resource "aws_s3_object" "invitation_parameters_put_quintiles_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "invitation_parameters_put_quintiles_lambda.zip"
  source = data.archive_file.invitation_parameters_put_quintiles_lambda.output_path

  etag = filemd5(data.archive_file.invitation_parameters_put_quintiles_lambda.output_path)
}

resource "aws_s3_object" "target_fill_to_percentage_put_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "target_fill_to_percentage_put_lambda.zip"
  source = data.archive_file.target_fill_to_percentage_put_lambda.output_path

  etag = filemd5(data.archive_file.target_fill_to_percentage_put_lambda.output_path)
}

resource "aws_s3_object" "target_fill_to_percentage_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "target_fill_to_percentage_lambda.zip"
  source = data.archive_file.target_fill_to_percentage_lambda.output_path

  etag = filemd5(data.archive_file.target_fill_to_percentage_lambda.output_path)
}

resource "aws_s3_object" "lsoa_in_range_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "lsoa_in_range_lambda.zip"
  source = data.archive_file.lsoa_in_range_lambda.output_path

  etag = filemd5(data.archive_file.lsoa_in_range_lambda.output_path)
}

resource "aws_s3_object" "participants_in_lsoa_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "participants_in_lsoa_lambda.zip"
  source = data.archive_file.participants_in_lsoa_lambda.output_path

  etag = filemd5(data.archive_file.participants_in_lsoa_lambda.output_path)
}

resource "aws_s3_bucket_policy" "allow_access_to_lambda" {
  bucket = "galleri-ons-data"
  policy = data.aws_iam_policy_document.allow_access_to_lambda.json
}

data "aws_iam_policy_document" "allow_access_to_lambda" {
  statement {
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::136293001324:role/github-oidc-invitations-role",
        aws_iam_role.galleri_lambda_role.arn
      ]
    }

    actions = [
      "s3:*"
    ]

    resources = [
      "arn:aws:s3:::galleri-ons-data/*"
    ]
  }
}

// API Gateway
resource "aws_api_gateway_rest_api" "galleri" {
  name        = "galleri-dev-local-2"
  description = "API for the galleri webapp"
  endpoint_configuration {
    types = ["REGIONAL"]
  }

}

// CLINIC INFORMATION - HTTP METHOD
resource "aws_api_gateway_resource" "clinic_information" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "clinic-information"
}

resource "aws_api_gateway_method" "clinic_information" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_information.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.clinicId"   = true,
    "method.request.querystring.clinicName" = true
  }
}

resource "aws_api_gateway_integration" "clinic_information_lambda" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_information.resource_id
  http_method = aws_api_gateway_method.clinic_information.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.clinic_information.invoke_arn

  depends_on = [aws_api_gateway_method.clinic_information]
}

resource "aws_api_gateway_integration_response" "clinic_information_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_information.id
  http_method = aws_api_gateway_method.clinic_information.http_method
  status_code = aws_api_gateway_method_response.clinic_information_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.clinic_information_lambda]
}

resource "aws_api_gateway_method_response" "clinic_information_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_information.resource_id
  http_method = aws_api_gateway_method.clinic_information.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.clinic_information]
}

// CLINIC INFORMATION - OPTIONS METHOD
resource "aws_api_gateway_method" "options_clinic_information" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_information.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_clinic_information" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_clinic_information.resource_id
  http_method = aws_api_gateway_method.options_clinic_information.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_clinic_information]
}

resource "aws_api_gateway_method_response" "options_clinic_information_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_information.id
  http_method = aws_api_gateway_method.options_clinic_information.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_clinic_information]
}

resource "aws_api_gateway_integration_response" "options_clinic_information" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_information.id
  http_method = aws_api_gateway_method.options_clinic_information.http_method
  status_code = aws_api_gateway_method_response.options_clinic_information_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_clinic_information]
}

// CLINIC ICB LIST - HTTP METHOD
resource "aws_api_gateway_resource" "clinic_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "clinic-icb-list"
}

resource "aws_api_gateway_method" "clinic_icb_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_icb_list.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.participatingIcb" = true
  }
}

resource "aws_api_gateway_integration" "clinic_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_icb_list.resource_id
  http_method = aws_api_gateway_method.clinic_icb_list.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.clinic_icb_list.invoke_arn

  depends_on = [aws_api_gateway_method.clinic_icb_list]
}

resource "aws_api_gateway_method_response" "clinic_icb_list_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_icb_list.resource_id
  http_method = aws_api_gateway_method.clinic_icb_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.clinic_icb_list]

}

resource "aws_api_gateway_integration_response" "clinic_icb_list_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_icb_list.id
  http_method = aws_api_gateway_method.clinic_icb_list.http_method
  status_code = aws_api_gateway_method_response.clinic_icb_list_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.clinic_icb_list]
}

// CLINIC ICB LIST - OPTIONS METHOD
resource "aws_api_gateway_method" "options_clinic_icb_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_icb_list.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_clinic_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_icb_list.id
  http_method = aws_api_gateway_method.options_clinic_icb_list.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_clinic_icb_list]
}

resource "aws_api_gateway_method_response" "options_clinic_icb_list_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_icb_list.id
  http_method = aws_api_gateway_method.options_clinic_icb_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_clinic_icb_list]
}

resource "aws_api_gateway_integration_response" "options_clinic_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_icb_list.id
  http_method = aws_api_gateway_method.options_clinic_icb_list.http_method
  status_code = aws_api_gateway_method_response.options_clinic_icb_list_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_clinic_icb_list]
}

// CLINIC SUMMARY LIST
resource "aws_api_gateway_resource" "clinic_summary_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "clinic-summary-list"
}

resource "aws_api_gateway_method" "clinic_summary_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_summary_list.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.participatingIcb" = true
  }
}

resource "aws_api_gateway_integration" "clinic_summary_list_lambda" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_summary_list.resource_id
  http_method = aws_api_gateway_method.clinic_summary_list.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.clinic_summary_list.invoke_arn

  depends_on = [aws_api_gateway_method.clinic_summary_list]
}

resource "aws_api_gateway_integration_response" "clinic_summary_list_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_summary_list.id
  http_method = aws_api_gateway_method.clinic_summary_list.http_method
  status_code = aws_api_gateway_method_response.clinic_summary_list_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.clinic_summary_list_lambda]
}

resource "aws_api_gateway_method_response" "clinic_summary_list_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.clinic_summary_list.resource_id
  http_method = aws_api_gateway_method.clinic_summary_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.clinic_summary_list]
}

resource "aws_api_gateway_method" "options_clinic_summary_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.clinic_summary_list.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_clinic_summary_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_clinic_summary_list.resource_id
  http_method = aws_api_gateway_method.options_clinic_summary_list.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_clinic_summary_list]
}

resource "aws_api_gateway_method_response" "options_clinic_summary_list_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_summary_list.id
  http_method = aws_api_gateway_method.options_clinic_summary_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_clinic_summary_list]
}

resource "aws_api_gateway_integration_response" "options_clinic_summary_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.clinic_summary_list.id
  http_method = aws_api_gateway_method.options_clinic_summary_list.http_method
  status_code = aws_api_gateway_method_response.options_clinic_summary_list_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_clinic_summary_list]
}

// PARTICIPATING ICB LIST
resource "aws_api_gateway_resource" "participating_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "participating-icb-list"
}

resource "aws_api_gateway_method" "participating_icb_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.participating_icb_list.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "participating_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.participating_icb_list.resource_id
  http_method = aws_api_gateway_method.participating_icb_list.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.participating_icb_list.invoke_arn

  depends_on = [aws_api_gateway_method.participating_icb_list]
}

resource "aws_api_gateway_method_response" "participating_icb_list_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.participating_icb_list.resource_id
  http_method = aws_api_gateway_method.participating_icb_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.participating_icb_list]
}
resource "aws_api_gateway_integration_response" "participating_icb_list_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participating_icb_list.id
  http_method = aws_api_gateway_method.participating_icb_list.http_method
  status_code = aws_api_gateway_method_response.participating_icb_list_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.participating_icb_list]
}

resource "aws_api_gateway_method" "options_participating_icb_list" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.participating_icb_list.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}
resource "aws_api_gateway_integration" "options_participating_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_participating_icb_list.resource_id
  http_method = aws_api_gateway_method.options_participating_icb_list.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_participating_icb_list]
}
resource "aws_api_gateway_method_response" "options_participating_icb_list_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participating_icb_list.id
  http_method = aws_api_gateway_method.options_participating_icb_list.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_participating_icb_list]
}

resource "aws_api_gateway_integration_response" "options_participating_icb_list" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participating_icb_list.id
  http_method = aws_api_gateway_method.options_participating_icb_list.http_method
  status_code = aws_api_gateway_method_response.options_participating_icb_list_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_participating_icb_list]
}

// INVITAITON PARAMETERS - HTTP METHOD -> HAPPY
resource "aws_api_gateway_resource" "invitation_parameters" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "invitation-parameters"
}

resource "aws_api_gateway_method" "invitation_parameters" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invitation_parameters" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters.resource_id
  http_method = aws_api_gateway_method.invitation_parameters.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invitation_parameters.invoke_arn

  depends_on = [aws_api_gateway_method.invitation_parameters]
}

resource "aws_api_gateway_integration_response" "invitation_parameters_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters.id
  http_method = aws_api_gateway_method.invitation_parameters.http_method
  status_code = aws_api_gateway_method_response.invitation_parameters_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.invitation_parameters]
}

resource "aws_api_gateway_method_response" "invitation_parameters_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters.resource_id
  http_method = aws_api_gateway_method.invitation_parameters.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.invitation_parameters]
}

// INVITAITON PARAMETERS - OPTIONS METHOD
resource "aws_api_gateway_method" "options_invitation_parameters" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_invitation_parameters" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_invitation_parameters.resource_id
  http_method = aws_api_gateway_method.options_invitation_parameters.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters]
}

resource "aws_api_gateway_method_response" "options_invitation_parameters_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters.id
  http_method = aws_api_gateway_method.options_invitation_parameters.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters]
}

resource "aws_api_gateway_integration_response" "options_invitation_parameters" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters.id
  http_method = aws_api_gateway_method.options_invitation_parameters.http_method
  status_code = aws_api_gateway_method_response.options_invitation_parameters_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_invitation_parameters]
}

// INVITAITON PARAMETERS, PUT FORECAST UPTAKE - HTTP METHOD
resource "aws_api_gateway_resource" "invitation_parameters_put_forecast_uptake" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "invitation-parameters-put-forecast-uptake"
}

resource "aws_api_gateway_method" "invitation_parameters_put_forecast_uptake" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters_put_forecast_uptake.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invitation_parameters_put_forecast_uptake" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters_put_forecast_uptake.resource_id
  http_method = aws_api_gateway_method.invitation_parameters_put_forecast_uptake.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invitation_parameters_put_forecast_uptake.invoke_arn

  depends_on = [aws_api_gateway_method.invitation_parameters_put_forecast_uptake]
}

resource "aws_api_gateway_integration_response" "invitation_parameters_put_forecast_uptake_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_forecast_uptake.id
  http_method = aws_api_gateway_method.invitation_parameters_put_forecast_uptake.http_method
  status_code = aws_api_gateway_method_response.invitation_parameters_put_forecast_uptake_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.invitation_parameters_put_forecast_uptake]
}

resource "aws_api_gateway_method_response" "invitation_parameters_put_forecast_uptake_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters_put_forecast_uptake.resource_id
  http_method = aws_api_gateway_method.invitation_parameters_put_forecast_uptake.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.invitation_parameters_put_forecast_uptake]
}

// INVITAITON PARAMETERS, PUT FORECAST UPTAKE - OPTIONS METHOD
resource "aws_api_gateway_method" "options_invitation_parameters_put_forecast_uptake" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters_put_forecast_uptake.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_invitation_parameters_put_forecast_uptake" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake.resource_id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake]
}

resource "aws_api_gateway_method_response" "options_invitation_parameters_put_forecast_uptake_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_forecast_uptake.id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake]
}

resource "aws_api_gateway_integration_response" "options_invitation_parameters_put_forecast_uptake" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_forecast_uptake.id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_forecast_uptake.http_method
  status_code = aws_api_gateway_method_response.options_invitation_parameters_put_forecast_uptake_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_invitation_parameters_put_forecast_uptake]
}

// INVITAITON PARAMETERS, PUT QUINTILES - HTTP METHOD
resource "aws_api_gateway_resource" "invitation_parameters_put_quintiles" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "invitation-parameters-put-quintiles"
}

resource "aws_api_gateway_method" "invitation_parameters_put_quintiles" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters_put_quintiles.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "invitation_parameters_put_quintiles" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters_put_quintiles.resource_id
  http_method = aws_api_gateway_method.invitation_parameters_put_quintiles.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.invitation_parameters_put_quintiles.invoke_arn

  depends_on = [aws_api_gateway_method.invitation_parameters_put_quintiles]
}

resource "aws_api_gateway_integration_response" "invitation_parameters_put_quintiles_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_quintiles.id
  http_method = aws_api_gateway_method.invitation_parameters_put_quintiles.http_method
  status_code = aws_api_gateway_method_response.invitation_parameters_put_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.invitation_parameters_put_quintiles]
}

resource "aws_api_gateway_method_response" "invitation_parameters_put_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters_put_quintiles.resource_id
  http_method = aws_api_gateway_method.invitation_parameters_put_quintiles.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.invitation_parameters_put_quintiles]
}

// INVITAITON PARAMETERS, PUT QUINTILES - OPTIONS METHOD
resource "aws_api_gateway_method" "options_invitation_parameters_put_quintiles" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.invitation_parameters_put_quintiles.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_invitation_parameters_put_quintiles" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.invitation_parameters_put_quintiles.resource_id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_quintiles.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters_put_quintiles]
}

resource "aws_api_gateway_method_response" "options_invitation_parameters_put_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_quintiles.id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_quintiles.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_invitation_parameters_put_quintiles]
}

resource "aws_api_gateway_integration_response" "options_invitation_parameters_put_quintiles" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.invitation_parameters_put_quintiles.id
  http_method = aws_api_gateway_method.options_invitation_parameters_put_quintiles.http_method
  status_code = aws_api_gateway_method_response.options_invitation_parameters_put_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_invitation_parameters_put_quintiles]
}

// TARGET PERCENTAGE - HTTP METHOD
resource "aws_api_gateway_resource" "target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "target-percentage"
}

resource "aws_api_gateway_method" "target_percentage" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.target_percentage.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.target_percentage.resource_id
  http_method = aws_api_gateway_method.target_percentage.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.get_target_fill_to_percentage.invoke_arn

  depends_on = [aws_api_gateway_method.target_percentage]
}

resource "aws_api_gateway_integration_response" "target_percentage_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.target_percentage.id
  http_method = aws_api_gateway_method.target_percentage.http_method
  status_code = aws_api_gateway_method_response.target_percentage_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.target_percentage]
}

resource "aws_api_gateway_method_response" "target_percentage_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.target_percentage.resource_id
  http_method = aws_api_gateway_method.target_percentage.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.target_percentage]
}

// TARGET PERCENTAGE - OPTIONS METHOD
resource "aws_api_gateway_method" "options_target_percentage" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.target_percentage.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_target_percentage.resource_id
  http_method = aws_api_gateway_method.options_target_percentage.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_target_percentage]
}

resource "aws_api_gateway_method_response" "options_target_percentage_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.target_percentage.id
  http_method = aws_api_gateway_method.options_target_percentage.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_target_percentage]
}

resource "aws_api_gateway_integration_response" "options_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.target_percentage.id
  http_method = aws_api_gateway_method.options_target_percentage.http_method
  status_code = aws_api_gateway_method_response.options_target_percentage_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_target_percentage]
}

// PUT TARGET PERCENTAGE - HTTP METHOD
resource "aws_api_gateway_resource" "put_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "put-target-percentage"
}

resource "aws_api_gateway_method" "put_target_percentage" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.put_target_percentage.id
  http_method   = "PUT"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "put_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.put_target_percentage.resource_id
  http_method = aws_api_gateway_method.put_target_percentage.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.target_fill_to_percentage_put.invoke_arn

  depends_on = [aws_api_gateway_method.put_target_percentage]
}

resource "aws_api_gateway_integration_response" "put_target_percentage_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.put_target_percentage.id
  http_method = aws_api_gateway_method.put_target_percentage.http_method
  status_code = aws_api_gateway_method_response.put_target_percentage_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.put_target_percentage]
}

resource "aws_api_gateway_method_response" "put_target_percentage_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.put_target_percentage.resource_id
  http_method = aws_api_gateway_method.put_target_percentage.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.put_target_percentage]
}

// PUT TARGET PERCENTAGE - OPTIONS METHOD
resource "aws_api_gateway_method" "options_put_target_percentage" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.put_target_percentage.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_put_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_put_target_percentage.resource_id
  http_method = aws_api_gateway_method.options_put_target_percentage.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_put_target_percentage]
}

resource "aws_api_gateway_method_response" "options_put_target_percentage_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.put_target_percentage.id
  http_method = aws_api_gateway_method.options_put_target_percentage.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_put_target_percentage]
}

resource "aws_api_gateway_integration_response" "options_put_target_percentage" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.put_target_percentage.id
  http_method = aws_api_gateway_method.options_put_target_percentage.http_method
  status_code = aws_api_gateway_method_response.options_put_target_percentage_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_put_target_percentage]
}

// LSOA IN RANGE - HTTP METHOD
resource "aws_api_gateway_resource" "lsoa_in_range" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "get-lsoa-in-range"
}

resource "aws_api_gateway_method" "lsoa_in_range" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.lsoa_in_range.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.clinicPostcode" = true
  }
}

resource "aws_api_gateway_integration" "lsoa_in_range_lambda" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.lsoa_in_range.resource_id
  http_method = aws_api_gateway_method.lsoa_in_range.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lsoa_in_range.invoke_arn

  depends_on = [aws_api_gateway_method.lsoa_in_range]
}

resource "aws_api_gateway_integration_response" "lsoa_in_range_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.lsoa_in_range.id
  http_method = aws_api_gateway_method.lsoa_in_range.http_method
  status_code = aws_api_gateway_method_response.lsoa_in_range_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.lsoa_in_range_lambda]
}

resource "aws_api_gateway_method_response" "lsoa_in_range_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.lsoa_in_range.resource_id
  http_method = aws_api_gateway_method.lsoa_in_range.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.lsoa_in_range]
}

// LSOA IN RANGE - OPTIONS METHOD
resource "aws_api_gateway_method" "options_lsoa_in_range" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.lsoa_in_range.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_lsoa_in_range" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_lsoa_in_range.resource_id
  http_method = aws_api_gateway_method.options_lsoa_in_range.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_lsoa_in_range]
}

resource "aws_api_gateway_method_response" "options_lsoa_in_range_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.lsoa_in_range.id
  http_method = aws_api_gateway_method.options_lsoa_in_range.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_lsoa_in_range]
}

resource "aws_api_gateway_integration_response" "options_lsoa_in_range" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.lsoa_in_range.id
  http_method = aws_api_gateway_method.options_lsoa_in_range.http_method
  status_code = aws_api_gateway_method_response.options_lsoa_in_range_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_lsoa_in_range]
}


// PARTICIPANTS IN LSOA - HTTP METHOD
resource "aws_api_gateway_resource" "participants_in_lsoa" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = "get-participants-in-lsoa"
}

resource "aws_api_gateway_method" "participants_in_lsoa" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.participants_in_lsoa.id
  http_method   = "GET"
  authorization = "NONE"

  request_parameters = {
    "method.request.querystring.lsoaList" = true
  }
}

resource "aws_api_gateway_integration" "participants_in_lsoa_lambda" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.participants_in_lsoa.resource_id
  http_method = aws_api_gateway_method.participants_in_lsoa.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.participants_in_lsoa.invoke_arn

  depends_on = [aws_api_gateway_method.participants_in_lsoa]
}

resource "aws_api_gateway_integration_response" "participants_in_lsoa_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participants_in_lsoa.id
  http_method = aws_api_gateway_method.participants_in_lsoa.http_method
  status_code = aws_api_gateway_method_response.participants_in_lsoa_response_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.participants_in_lsoa_lambda]
}

resource "aws_api_gateway_method_response" "participants_in_lsoa_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.participants_in_lsoa.resource_id
  http_method = aws_api_gateway_method.participants_in_lsoa.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.participants_in_lsoa]
}

// PARTICIPANTS IN LSOA - OPTIONS METHOD
resource "aws_api_gateway_method" "options_participants_in_lsoa" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.participants_in_lsoa.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_participants_in_lsoa" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options_participants_in_lsoa.resource_id
  http_method = aws_api_gateway_method.options_participants_in_lsoa.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options_participants_in_lsoa]
}

resource "aws_api_gateway_method_response" "options_participants_in_lsoa_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participants_in_lsoa.id
  http_method = aws_api_gateway_method.options_participants_in_lsoa.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }

  depends_on = [aws_api_gateway_method.options_participants_in_lsoa]
}

resource "aws_api_gateway_integration_response" "options_participants_in_lsoa" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.participants_in_lsoa.id
  http_method = aws_api_gateway_method.options_participants_in_lsoa.http_method
  status_code = aws_api_gateway_method_response.options_participants_in_lsoa_200.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.options_participants_in_lsoa]
}


// AWS LAMBDA PERMISSIONS
resource "aws_lambda_permission" "api_gw_clinic_information" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clinic_information.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_clinic_icb_list" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clinic_icb_list.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_participating_icb_list" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.participating_icb_list.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_clinic_summary_list" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.clinic_summary_list.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_invitation_parameters" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invitation_parameters.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_invitation_parameters_put_forecast_uptake" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invitation_parameters_put_forecast_uptake.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/PUT/*"
}

resource "aws_lambda_permission" "api_gw_invitation_parameters_put_quintiles" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.invitation_parameters_put_quintiles.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/PUT/*"
}

resource "aws_lambda_permission" "api_gw_target_percentage" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_target_fill_to_percentage.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_put_target_percentage" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.target_fill_to_percentage_put.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/PUT/*"
}

resource "aws_lambda_permission" "api_gw_lsoa_in_range" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lsoa_in_range.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_lambda_permission" "api_gw_participants_in_lsoa" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.participants_in_lsoa.function_name
  principal     = "apigateway.amazonaws.com"

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}/*/GET/*"
}

resource "aws_api_gateway_deployment" "galleri" {

  rest_api_id = aws_api_gateway_rest_api.galleri.id
  stage_name  = "dev"

  depends_on = [
    aws_api_gateway_integration.clinic_information_lambda,
    aws_api_gateway_integration_response.options_clinic_icb_list,
    aws_api_gateway_integration_response.clinic_icb_list_integration_response,
    aws_api_gateway_integration_response.options_clinic_information,
    aws_api_gateway_integration_response.clinic_information_integration_response,
    aws_api_gateway_integration_response.invitation_parameters_integration_response,
    aws_api_gateway_integration_response.invitation_parameters_put_quintiles_integration_response,
    aws_api_gateway_integration_response.invitation_parameters_put_forecast_uptake_integration_response,
    aws_api_gateway_integration.clinic_icb_list,
    aws_api_gateway_integration.clinic_summary_list_lambda,
    aws_api_gateway_integration.target_percentage,
    aws_api_gateway_integration_response.options_target_percentage,
    aws_api_gateway_integration_response.options_put_target_percentage,
  ]
}
