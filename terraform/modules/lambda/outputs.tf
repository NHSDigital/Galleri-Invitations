output "lambda_function_name" {
  value = aws_lambda_function.lambda.function_name
}

output "lambda_invoke_arn" {
  value = aws_lambda_function.lambda.invoke_arn
}

output "lambda_arn" {
  value = aws_lambda_function.lambda.arn
}

# output "cloudwatch_log_group_arn" {
#   value = aws_cloudwatch_log_group.log_group.arn
# }

# output "cloudwatch_metric_alarm_arn" {
#   value = aws_cloudwatch_metric_alarm.error_alarm.arn
# }
