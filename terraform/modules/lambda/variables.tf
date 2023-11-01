variable "bucket_id" {}

variable "lambda_function_name" {
  type = string
}

variable "lambda_timeout" {
  type    = number
  default = 900
}

variable "memory_size" {
  type    = number
  default = 1024
}

variable "runtime" {
  type    = string
  default = "nodejs18.x"
}

variable "lambda_iam_role" {}

variable "lambda_s3_object_key" {}

variable "environment_vars" {}
