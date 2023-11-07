variable "bucket_id" {
  type        = string
  description = "ID of the S3 bucket"
}

variable "key" {
  description = "s3 bucket key"
  type        = string
}

variable "data_source" {
  description = "link to the source for the s3 object"
  type        = string
}

variable "etag" {
  description = "The entity tag is a hash of the object"
  type        = string
}
