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

variable "environment" {}

variable "K8_URL" {
  description = "url for eks mesh service"
  default     = null
}

variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "App"
}