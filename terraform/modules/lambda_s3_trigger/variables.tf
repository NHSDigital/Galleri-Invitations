locals {
  unique_lambda_arns = { for trigger_id, trigger in var.triggers : trigger_id => trigger.lambda_arn }
}

variable "triggers" {
  description = "List of triggers for the Lambda function"
  type = map(object({
    lambda_arn    = string
    bucket_events = list(string)
    filter_prefix = string
    filter_suffix = string
  }))
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket"
  type        = string
}

variable "bucket_id" {
  description = "ID of the S3 bucket"
  type        = string
}

variable "name" {
  type        = string
  description = "the name of the iam rule"
}

variable "environment" {
  type = string
  description = "Environment variable"
}
