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
  default     = "/Users/aymene/Development/Galleri/Galleri-Frontend"
}

variable "USERS" {
  default = null
}

variable "CIS2_ID" {
  default = null
}

variable "CIS2_SECRET" {
  default = null
}

variable "NEXTAUTH_SECRET" {
  default = null
}

variable "NEXTAUTH_URL" {
  default = null
}
