resource "aws_api_gateway_rest_api" "galleri" {
  name        = "galleri-dev-local-2"
  description = "API for the galleri webapp"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

resource "aws_api_gateway_resource" "lambda_api_gateway" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = var.api_gateway_path_part
}

resource "aws_api_gateway_method" "lambda_api_gateway_method" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.lambda_api_gateway.id
  http_method   = var.lambda_api_gateway_method
  authorization = "NONE"

  request_parameters = var.api_gateway_method_request_parameters
}

resource "aws_api_gateway_integration" "lambda_api_gateway_integration" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.lambda_api_gateway_method.resource_id
  http_method = aws_api_gateway_method.lambda_api_gateway_method.http_method

  integration_http_method = var.integration_http_method
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn

  depends_on = [aws_api_gateway_method.lambda_api_gateway_method]
}

resource "aws_api_gateway_method_response" "lambda_api_gateway_response_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.lambda_api_gateway_method.resource_id
  http_method = aws_api_gateway_method.lambda_api_gateway_method.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = var.api_gateway_method_response_200_response_parameters

  depends_on = [aws_api_gateway_method.lambda_api_gateway_method]
}

resource "aws_api_gateway_integration_response" "lambda_api_gateway_integration_response" {
  rest_api_id         = aws_api_gateway_rest_api.galleri.id
  resource_id         = aws_api_gateway_resource.lambda_api_gateway.id
  http_method         = aws_api_gateway_method.lambda_api_gateway_method.http_method
  status_code         = aws_api_gateway_method_response.lambda_api_gateway_response_200.status_code
  response_parameters = var.api_gateway_integration_response_response_parameters

  depends_on = [aws_api_gateway_integration.lambda_api_gateway_integration]
}

resource "aws_api_gateway_method" "lambda_api_gateway_method_options" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.lambda_api_gateway.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_api_gateway_integration_options" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.lambda_api_gateway_method_options.resource_id
  http_method = aws_api_gateway_method.lambda_api_gateway_method_options.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.lambda_api_gateway_method_options]
}

resource "aws_api_gateway_method_response" "lambda_api_gateway_method_response_options_200" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.lambda_api_gateway.id
  http_method = aws_api_gateway_method.lambda_api_gateway_method_options.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = var.api_gateway_method_response_200_response_parameters

  depends_on = [aws_api_gateway_method.lambda_api_gateway_method_options]
}

resource "aws_api_gateway_integration_response" "lambda_api_gateway_integration_response_options" {
  rest_api_id         = aws_api_gateway_rest_api.galleri.id
  resource_id         = aws_api_gateway_resource.lambda_api_gateway.id
  http_method         = aws_api_gateway_method.lambda_api_gateway_method_options.http_method
  status_code         = aws_api_gateway_method_response.lambda_api_gateway_method_response_options_200.status_code
  response_parameters = var.api_gateway_integration_response_options_response_parameters

  depends_on = [aws_api_gateway_integration.lambda_api_gateway_integration_options]
}
