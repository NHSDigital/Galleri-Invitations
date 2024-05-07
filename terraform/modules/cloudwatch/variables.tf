variable "lambda_function_name" {}
variable "retention_days" {}
variable "environment" {}
variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "Monitoring"
}
