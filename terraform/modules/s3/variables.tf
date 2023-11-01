variable "bucket_name" {
  type        = string
  description = "Name of the S3 bucket"
}

variable "region" {
  type        = string
  description = "AWS Region"
  default     = "eu-west-2"
}

variable "galleri_lambda_role_arn" {}
