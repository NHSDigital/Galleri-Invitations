variable "path_part" {}
variable "lambda_invoke_arn" {}
variable "method_http_parameters" {}
variable "integration_response_http_parameters" {
  default = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
variable "integration_response_options_parameters" {
  default = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'*'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
variable "method_response_http_parameters" {
  default = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}
variable "method_response_options_parameters" {
  default = {
    "method.response.header.Access-Control-Allow-Origin"  = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}
variable "lambda_api_gateway_method" {
  default = "GET"
}
variable "integration_http_method" {
  default = "POST"
}

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
variable "method" {
  default = "/*/GET/*"
}

variable "environment" {

}
variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "API Management"
}

variable "hostname" {
}

variable "dns_zone" {
}

variable "region" {
  default = "us-east-1"
}
