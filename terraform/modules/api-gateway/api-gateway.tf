# Set up cloudwatch logging
resource "aws_cloudwatch_log_group" "api_gateway_log_group" {
  name              = "/aws/apigateway/${var.environment}-${var.path_part}"
  retention_in_days = 90
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} API Gateway Cloudwatch Logging"
  }
}

# Create API Gateway
resource "aws_api_gateway_rest_api" "galleri" {
  name        = "${var.environment}-${var.path_part}"
  description = "API for the galleri webapp"
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} API Gateway"
  }
}

# resource "aws_api_gateway_stage" "stage" {
#   stage_name    = var.environment
#   rest_api_id   = aws_api_gateway_rest_api.galleri.id
#   deployment_id = aws_api_gateway_deployment.galleri.id

#   access_log_settings {
#     destination_arn = aws_cloudwatch_log_group.api_gateway_log_group.arn
#     format = jsonencode({
#       requestId      = "$context.requestId",
#       ip             = "$context.identity.sourceIp",
#       caller         = "$context.identity.caller",
#       user           = "$context.identity.user",
#       requestTime    = "$context.requestTime",
#       httpMethod     = "$context.httpMethod",
#       resourcePath   = "$context.resourcePath",
#       status         = "$context.status",
#       protocol       = "$context.protocol",
#       responseLength = "$context.responseLength"
#     })
#   }

#   xray_tracing_enabled = true
#   depends_on           = [aws_api_gateway_deployment.galleri]
# }

resource "aws_api_gateway_deployment" "galleri" {
  stage_name  = var.environment
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  lifecycle {
    create_before_destroy = true
  }
  depends_on = [
    aws_api_gateway_method.http,
    aws_api_gateway_method.options,
    aws_api_gateway_integration.http,
    aws_api_gateway_integration.options
  ]
}


// HTTP METHOD
resource "aws_api_gateway_resource" "gateway" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  parent_id   = aws_api_gateway_rest_api.galleri.root_resource_id
  path_part   = var.path_part
}

resource "aws_api_gateway_method" "http" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.gateway.id
  http_method   = var.lambda_api_gateway_method
  authorization = "NONE"

  request_parameters = var.method_http_parameters
}

resource "aws_api_gateway_integration" "http" {
  rest_api_id             = aws_api_gateway_rest_api.galleri.id
  resource_id             = aws_api_gateway_method.http.resource_id
  http_method             = aws_api_gateway_method.http.http_method
  integration_http_method = var.integration_http_method
  type                    = "AWS_PROXY"
  uri                     = var.lambda_invoke_arn

  depends_on = [aws_api_gateway_method.http]
}

resource "aws_api_gateway_method_response" "http" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.http.resource_id
  http_method = aws_api_gateway_method.http.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = var.method_response_http_parameters
  depends_on          = [aws_api_gateway_method.http]
}

resource "aws_api_gateway_integration_response" "http" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.gateway.id
  http_method = aws_api_gateway_method.http.http_method
  status_code = aws_api_gateway_method_response.http.status_code

  response_parameters = var.integration_response_http_parameters
  depends_on          = [aws_api_gateway_integration.http]
}


// OPTIONS METHOD
resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.galleri.id
  resource_id   = aws_api_gateway_resource.gateway.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_method.options.resource_id
  http_method = aws_api_gateway_method.options.http_method

  type = "MOCK"
  request_templates = { # Not documented
    "application/json" = "{statusCode: 200}"
  }

  depends_on = [aws_api_gateway_method.options]
}

resource "aws_api_gateway_method_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.galleri.id
  resource_id = aws_api_gateway_resource.gateway.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = 200

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = var.method_response_options_parameters

  depends_on = [aws_api_gateway_method.options]
}

resource "aws_api_gateway_integration_response" "options" {
  rest_api_id         = aws_api_gateway_rest_api.galleri.id
  resource_id         = aws_api_gateway_resource.gateway.id
  http_method         = aws_api_gateway_method.options.http_method
  status_code         = aws_api_gateway_method_response.options.status_code
  response_parameters = var.integration_response_options_parameters

  depends_on = [aws_api_gateway_integration.options]
}

# Lambda Permissions

resource "aws_lambda_permission" "lambda_permission" {
  statement_id  = var.statement_id
  action        = var.action
  function_name = var.lambda_function_name
  principal     = var.principal

  # The /*/* portion grants access from any method on any resource
  # within the API Gateway "REST API".
  source_arn = "${aws_api_gateway_rest_api.galleri.execution_arn}${var.method}"
}
