variable "environment" {

}

variable "name" {

}

variable "cluster_name" {
  type    = string
  default = "eks-cluster"
}

variable "application_role" {
  description = "Used for tagging resource according to Cloud guidelines"
  default     = "Resource Management"
}