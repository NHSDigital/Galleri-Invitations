variable "bucket_name" {
  type    = string
  default = "galleri-lambda-bucket"
}
variable "role_name" {
  type    = string
  default = "galleri-lambda-role"
}

variable "environment" {
  description = "The environment being deployed into, could be: dev, test, uat, performance or prod"
}

variable "frontend_repo_location" {
  description = "The location of the Galler-Frontend repo on the filesystem"
  default     = "/Users/zain/projects/Galleri-Frontend"
}

# variable "aws_account_number" {}
