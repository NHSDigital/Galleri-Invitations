resource "aws_cloudwatch_event_rule" "schedule_rule" {
  name                = var.function_name
  description         = "Trigger Lambda function depending on cron function"
  schedule_expression = var.schedule_expression
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} Scheduling Rule"
  }
}

resource "aws_cloudwatch_event_target" "lambda_target" {
  rule      = aws_cloudwatch_event_rule.schedule_rule.name
  target_id = "invoke_lambda"
  arn       = var.lambda_arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_arn
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.schedule_rule.arn
}
