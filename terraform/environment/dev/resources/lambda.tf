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

resource "aws_iam_policy" "iam_policy_for_clinic_details_lambda" {
  name        = "aws_iam_policy_for_terraform_aws_clinic_details_lambda_role"
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

resource "aws_iam_role_policy_attachment" "galleri_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_lambda.arn
}

resource "aws_iam_role_policy_attachment" "clinic_details_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_clinic_details_lambda.arn
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

data "archive_file" "clinic_details_lambda" {
  type = "zip"

  source_dir  = "${path.cwd}/lambda/clinicInformation/lambdaHandler"
  output_path = "${path.cwd}/lambda/clinicInformation/lambdaHandler/clinicInformationLambda.zip"
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
  role          = aws_iam_role.clinic_details_lambda_policy.arn
  handler       = "clinicInformationLambda.handler"
  runtime       = "nodejs18.x"
  timeout       = 100
  memory_size   = 1024

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

// Create cloudwatch log group
resource "aws_cloudwatch_log_group" "data_filter_gridall_imd" {
  name = "/aws/lambda/${aws_lambda_function.data_filter_gridall_imd.function_name}"

  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "non_prod_lsoa_loader" {
  name = "/aws/lambda/${aws_lambda_function.non_prod_lsoa_loader.function_name}"

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
