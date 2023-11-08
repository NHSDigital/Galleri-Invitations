data "archive_file" "lambda_archive" {
  type = "zip"

  source_dir  = "${path.cwd}/src/${var.lambda_function_name}"
  output_path = "${path.cwd}/src/${var.lambda_function_name}/${var.lambda_function_name}.zip"
}

resource "aws_lambda_function" "lambda" {
  function_name = "${var.environment}-${var.lambda_function_name}"
  role          = var.lambda_iam_role
  handler       = "${var.lambda_function_name}.handler"
  runtime       = var.runtime
  timeout       = var.lambda_timeout
  memory_size   = var.memory_size

  s3_bucket = var.bucket_id
  s3_key    = aws_s3_object.lambda_s3_object.key

  source_code_hash = data.archive_file.lambda_archive.output_base64sha256

  environment {
    variables = var.environment_vars
  }
}

resource "aws_s3_object" "lambda_s3_object" {
  bucket = var.bucket_id

  key    = var.lambda_s3_object_key
  source = data.archive_file.lambda_archive.output_path

  etag = filemd5(data.archive_file.lambda_archive.output_path)
}
