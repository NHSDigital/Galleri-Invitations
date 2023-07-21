resource "aws_s3_bucket" "basic_s3_bucket" {
  bucket        = "basic_s3_bucket"
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}
