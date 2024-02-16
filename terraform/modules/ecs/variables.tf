variable "name" {
  default     = "test"
  description = "Name of the cluster"
}

variable "task_name" {
  default     = "test"
  description = "Name of the Task"
}

variable "image" {
  default     = "thorlogic/fhir-validator-r4:6.10.33"
  description = "Name and version of container image"
}

variable "subnet_ids" {
  description = "an array of subnets to pass in, requires at least one subnet"
}

variable "environment" {

}

variable "vpc_id" {

}
