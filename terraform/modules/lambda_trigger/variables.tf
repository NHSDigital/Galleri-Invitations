variable "bucket_id" {}

variable "bucket_arn" {}

variable "lambda_arn" {}

variable "statement_id" {
  type    = string
  default = "AllowExecutionFromS3Bucket"
}

variable "filter_prefix" {
  default = ""
}

variable "filter_suffix" {
  default = ""
}

variable "bucket_events" {
  default = "s3:ObjectCreated:*"
}

