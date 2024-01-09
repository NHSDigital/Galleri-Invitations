variable "bucket_id" {}

variable "bucket_arn" {}

variable "lambda_arn" {}

variable "filter_prefix" {
  default = ""
}

variable "filter_suffix" {
  default = ""
}

variable "bucket_events" {
  default = "s3:ObjectCreated:*"
}

