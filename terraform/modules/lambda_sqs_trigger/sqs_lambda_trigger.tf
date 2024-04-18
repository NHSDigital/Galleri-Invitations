resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = var.event_source_arn
  function_name    = var.lambda_arn
}
