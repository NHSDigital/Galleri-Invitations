variable "account_id" {
  description = "AWS Account ID"
  default     = "136293001324"
}

variable "name" {
  description = "name of the s3 service"
}

variable "dns_zone" {
  description = "The prefix for the DNS for this environment"
  default     = ""
}

variable "environment" {
}
