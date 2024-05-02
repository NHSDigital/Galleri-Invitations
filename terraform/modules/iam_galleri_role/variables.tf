variable "role_name" {
  type        = string
  description = "The name for the role"
}

variable "environment" {}

variable "account_id" {}

variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "Security"
}
