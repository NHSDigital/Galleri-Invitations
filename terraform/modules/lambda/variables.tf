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

# variable "alarm_actions" {
#   type        = list(string)
#   description = "The list of actions to execute when this alarm transitions into an ALARM state."
#   default     = ["arn:aws:sns:ue-west-2:${var.account_id}:NotifyMe"]
# }

# variable "account_id" {
#   type        = string
#   description = "AWS Account ID"
# }
