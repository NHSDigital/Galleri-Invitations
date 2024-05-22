resource "aws_sns_topic_subscription" "lambda_subscription" {
  topic_arn = var.sns_topic_arn
  protocol  = var.protocol
  endpoint  = var.subscription_endpoint
}

resource "aws_lambda_permission" "sns_invoke_lambda" {
  statement_id  = var.statement_id
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_name
  principal     = "sns.amazonaws.com"
  source_arn    = var.sns_topic_arn

  # Dependency on the SNS topic subscription resource
  depends_on = [aws_sns_topic_subscription.lambda_subscription]
}
