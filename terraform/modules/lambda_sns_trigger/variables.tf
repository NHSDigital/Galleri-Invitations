variable "protocol" {
  type    = string
  default = "lambda"
}

variable "subscription_endpoint" {
  type    = string
  default = ""
}

variable "sns_topic_arn" {
  type    = string
  default = ""
}

variable "lambda_name" {
  type    = string
  default = ""
}

variable "statement_id" {
  type    = string
  default = "AllowExecutionFromS3Bucket"
}
