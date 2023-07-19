resource "aws_s3_bucket" "basic-s3-bucket" {
  bucket        = "basic-s3-bucket"
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}
