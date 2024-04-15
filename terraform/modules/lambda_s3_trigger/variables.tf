locals {
  // Extracts all Lambda ARNs and deduplicates them.
  unique_lambda_arns = toset([for trigger in var.triggers : trigger.lambda_arn])
}

variable "triggers" {
  description = "List of triggers for the Lambda function"
  type = list(object({
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
