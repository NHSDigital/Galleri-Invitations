variable "name" {
  type = string
}

variable "environment" {}

variable "is_fifo_topic" {
  type    = bool
  default = false
}

variable "is_content_based_deduplication" {
  type    = bool
  default = false
}
