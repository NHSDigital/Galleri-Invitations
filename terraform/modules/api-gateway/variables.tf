variable "lambda_invoke_arn" {}
variable "api_gateway_path_part" {}
variable "api_gateway_method_request_parameters" {}
variable "api_gateway_method_response_200_response_parameters" {}
variable "api_gateway_integration_response_response_parameters" {}
variable "api_gateway_method_response_options_200_response_parameters" {}
variable "api_gateway_integration_response_options_response_parameters" {}
variable "lambda_api_gateway_method" {
  default = "GET"
}
variable "integration_http_method" {
  default = "POST"
}
