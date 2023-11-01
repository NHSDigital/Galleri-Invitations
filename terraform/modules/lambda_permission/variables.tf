variable "rest_api_galleri_execution_arn" {}
variable "lambda_function_name" {}
variable "statement_id" {
  default = "AllowAPIGatewayInvoke"
}
variable "action" {
  default = "lambda:InvokeFunction"
}
variable "principal" {
  default = "apigateway.amazonaws.com"
}
