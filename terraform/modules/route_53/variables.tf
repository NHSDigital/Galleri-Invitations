locals {
  alias_name_valid = (
    var.alias_name != null
  )
}

variable "environment" {
  description = "Which environment to deploy into: dev, test, uat, performance or prod"
}

variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "Security"
}

variable "dns_zone" {

}

variable "region" {

}

variable "hostname" {

}

variable "alias_name" {
  description = "Name of ALB of FHIR service"
  type        = string
}

variable "alias_zone_id" {
  description = "Zone ID of ALB of FHIR service"
  type        = string
}
