variable "name" {
  type    = string
  default = "eks-cluster"
}

variable "environment" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}
