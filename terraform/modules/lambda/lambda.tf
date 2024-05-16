# Monitoring
resource "aws_cloudwatch_log_group" "log_group" {
  name = "/aws/lambda/${var.environment}-${var.lambda_function_name}"

  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      tags,
    ]
  }
}

resource "aws_cloudwatch_log_metric_filter" "error_filter" {
  name           = "${var.environment}-${var.lambda_function_name}-error-filter"
  log_group_name = aws_cloudwatch_log_group.log_group.name
  pattern        = "Error"
  metric_transformation {
    namespace     = "LogErrors"
    name          = "ErrorCount-${var.lambda_function_name}"
    value         = "1"
    unit          = "Count"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_alarm" {
  alarm_name                = "${var.environment}-${var.lambda_function_name}-error-alarm"
  alarm_description         = "${var.environment}-${var.lambda_function_name} has encountered an error"
  comparison_operator       = "GreaterThanOrEqualToThreshold"
  evaluation_periods        = 1
  metric_name               = "ErrorCount-${var.lambda_function_name}"
  namespace                 = "LogErrors"
  period                    = 60
  statistic                 = "Sum"
  threshold                 = 1
  actions_enabled           = true
  alarm_actions             = [var.sns_topic_arn]
  ok_actions                = []
  insufficient_data_actions = []
}

resource "aws_sns_topic_subscription" "subscription" {
  topic_arn = var.sns_topic_arn
  protocol  = "lambda"
  endpoint  = var.sns_lambda_arn
}

# Lambda config
data "archive_file" "lambda_archive" {
  type        = "zip"
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
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} ${var.lambda_function_name} Lambda App"
  }
  depends_on = [aws_cloudwatch_log_group.log_group, aws_cloudwatch_metric_alarm.error_alarm]
}

resource "aws_s3_object" "lambda_s3_object" {
  bucket = var.bucket_id
  key    = var.lambda_s3_object_key
  source = data.archive_file.lambda_archive.output_path

  etag = filemd5(data.archive_file.lambda_archive.output_path)
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} ${var.lambda_function_name} Lambda S3 Object"
  }
}
