variable "bucket_name" {
  type = string
}
variable "role_name" {}

variable "environment" {
  description = "The environment being deployed into, could be: dev, test, uat, performance or prod"
}

variable "frontend_repo_location" {
  description = "The location of the Galler-Frontend repo on the filesystem"
}

# variable "aws_account_number" {}

variable "frontend_repo_location" {
  default = ""
}
