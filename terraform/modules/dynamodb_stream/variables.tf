variable "event_source_arn" {
  default = ""
}

variable "starting_position" {
  default = ""
}

variable "enabled" {
  default = false
}

variable "function_name" {
  default = ""
}

variable "batch_size" {
  default = 1
}

variable "maximum_batching_window_in_seconds" {
  default = 10
}

variable "filter_event_name" {
  default = ["INSERT", "MODIFY"]
}
