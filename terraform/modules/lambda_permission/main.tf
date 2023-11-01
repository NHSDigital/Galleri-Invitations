resource "aws_lambda_permission" "lambda_permission" {
  statement_id  = var.statement_id
  action        = var.action
  function_name = var.lambda_function_name
  principal     = var.principal

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${var.rest_api_galleri_execution_arn}/*/GET/*"
}
