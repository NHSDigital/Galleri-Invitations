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

resource "aws_iam_role" "data_filter_gridall_imd" {
  name = "data-filter-gridall-imd"

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

resource "aws_iam_role_policy_attachment" "data_filter_gridall_imd_policy" {
  role       = aws_iam_role.data_filter_gridall_imd.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "data_filter_gridall_imd" {
  function_name = "dataFilterLambda"
  filename      = data.archive_file.data_filter_gridall_imd_lambda.output_path

  s3_bucket = aws_s3_bucket.galleri_lambda_bucket.id
  s3_key    = aws_s3_object.data_filter_gridall_imd_lambda.key

  runtime = "nodejs18.x"
  handler = "function.handler"

  source_code_hash = data.archive_file.data_filter_gridall_imd_lambda.output_base64sha256

  role = aws_iam_role.data_filter_gridall_imd.arn
}

resource "aws_cloudwatch_log_group" "data_filter_gridall_imd" {
  name = "/aws/lambda/${aws_lambda_function.data_filter_gridall_imd.function_name}"

  retention_in_days = 14
}

data "archive_file" "data_filter_gridall_imd_lambda" {
  type = "zip"

  source_file = "/lambda/imdGridal/dataFilterLambda"
  output_path = "/lambda/imdGridal/data_filter_gridall_imd.zip"
}

resource "aws_s3_object" "data_filter_gridall_imd_lambda" {
  bucket = aws_s3_bucket.galleri_lambda_bucket.id

  key    = "data_filter_gridall_imd.zip"
  source = data.archive_file.data_filter_gridall_imd_lambda.output_path

  etag = filemd5(data.archive_file.data_filter_gridall_imd_lambda.output_path)
}
