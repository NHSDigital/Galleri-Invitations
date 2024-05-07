resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name = "/aws/lambda/${var.lambda_function_name}"

  retention_in_days = 14
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} Lambda Log Group"
  }
}
