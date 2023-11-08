variable "role_name" {
  type        = string
  description = "The name for the role"
  default     = "galleri-lambda-role"
}

variable "name" {}

variable "path" {
  default = "/"
}

variable "description" {}

variable "policy" {
  type        = string
  description = "json block of IAM permissions"
}

# variable "aws_account_number" {}

variable "environment" {}
