# Monitoring
resource "aws_cloudwatch_log_group" "log_group" {
  name = "/aws/lambda/${var.environment}-${var.lambda_function_name}"

  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      tags, # Add any other attributes that might change outside of Terraform's management
    ]
  }
}

resource "aws_cloudwatch_log_metric_filter" "error_filter" {
  name           = "${var.environment}-${var.lambda_function_name}"
  log_group_name = aws_cloudwatch_log_group.log_group.name
  pattern        = "Error"
  metric_transformation {
    namespace = "LogErrors"
    name      = "ErrorCount"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "error_alarm" {
  alarm_name                = "${var.environment}-${var.lambda_function_name}"
  comparison_operator       = "GreaterThanOrEqualToThreshold"
  evaluation_periods        = 1
  metric_name               = "ErrorCount"
  namespace                 = "LogErrors"
  period                    = 300
  statistic                 = "Sum"
  threshold                 = 1
  alarm_description         = "This alarm fires when 'Error' occurrences are detected in the logs."
  actions_enabled           = true
  alarm_actions             = [aws_sns_topic.alarm_topic.arn]
  insufficient_data_actions = []
}

resource "aws_sns_topic" "alarm_topic" {
  name = "${var.environment}-${var.lambda_function_name}"
}

resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.alarm_topic.arn
  protocol  = "lambda"
  endpoint  = var.sns_lambda_arn != "" ? var.sns_lambda_arn : aws_lambda_function.lambda.arn
}

resource "aws_lambda_permission" "allow_sns_to_invoke_lambda" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.alarm_topic.arn
}

# Lambda config
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
  depends_on = [aws_cloudwatch_log_group.log_group]
}

resource "aws_s3_object" "lambda_s3_object" {
  bucket = var.bucket_id

  key    = var.lambda_s3_object_key
  source = data.archive_file.lambda_archive.output_path

  etag = filemd5(data.archive_file.lambda_archive.output_path)
}

