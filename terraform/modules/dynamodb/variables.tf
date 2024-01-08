variable "table_name" {
  description = "the table name"
}

variable "billing_mode" {
  description = "method of billing"
  default     = "PROVISIONED"
}

variable "read_capacity" {
  default = 20
}

variable "write_capacity" {
  default = 20
}

variable "hash_key" {
  description = "A Hash Key consists of a single attribute that uniquely identifies an item"
}

variable "range_key" {
  description = "A Hash and Range Key consists of two attributes that together, uniquely identify an item"
  default     = ""
}

variable "attributes" {
  description = "A map of keys for the dynamodb table"
  type = list(object({
    name = string
    type = string
  }))
}

variable "global_secondary_index" {
  description = "optional secondary index"
  type = list(object({
    name      = string
    hash_key  = string
    range_key = string
  }))
  default = []
}

variable "secondary_write_capacity" {
  default = 10
}

variable "secondary_read_capacity" {
  default = 10
}

variable "projection_type" {
  default = "KEYS_ONLY"
}

variable "non_key_attributes" {
  default = []
}

variable "point_in_time_recovery" {
  default = true
}

variable "server_side_encryption" {
  default = true
}

variable "tags" {
  description = "A map of tags for the db"
  type        = map(string)
  default     = {}
}

variable "environment" {}

variable "stream_enabled" {
  default = false
}

variable "stream_view_type" {
  default = ""
}
