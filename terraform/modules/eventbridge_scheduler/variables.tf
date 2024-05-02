variable "function_name" {
  description = "Name of lambda function"
  type        = string
}

variable "schedule_expression" {
  description = "Schedule expression for triggering lambda"
  type        = string
}

variable "lambda_arn" {
  description = "ARN of the lambda function being invoked"
  type        = string
}
