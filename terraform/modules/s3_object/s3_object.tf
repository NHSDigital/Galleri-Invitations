resource "aws_s3_object" "object" {
  bucket = var.bucket_id
  key    = var.key
  source = var.data_source
  etag   = var.etag
}
