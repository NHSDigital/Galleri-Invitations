variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "cluster_id" {
  type = string
}

variable "desired_count" {
  type = number
}

variable "vpc_id" {
  type = string
}

variable "subnets" {
  type = list(string)
}

variable "public_ip" {
  type = bool
}

variable "image" {
  type = string
}

variable "cpu" {
  type    = number
  default = 1024
}

variable "memory" {
  type    = number
  default = 2048
}

variable "container_port" {
  type    = number
  default = 443
}

variable "host_port" {
  type    = number
  default = 443
}
