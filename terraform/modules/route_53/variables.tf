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

}

variable "alias_zone_id" {

}
