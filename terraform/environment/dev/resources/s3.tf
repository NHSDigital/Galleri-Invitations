resource "aws_s3_bucket" "basic_s3_bucket" {
  bucket        = "BasicS3Bucket"
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "dev"
  }
}
