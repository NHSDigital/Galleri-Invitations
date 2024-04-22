variable "name" {
  type = string
}

variable "is_fifo_queue" {
  type    = bool
  default = false
}

variable "is_content_based_deduplication" {
  type    = bool
  default = false
}

variable "visibility_timeout_seconds" {
  type    = number
  default = 30
}

variable "environment" {}
