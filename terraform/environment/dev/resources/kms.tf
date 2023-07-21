resource "aws_kms_key" "dynamodb_kms_key" {
  description             = "Dynamodb KMS Key for Data Encryption"
  is_enabled              = true
  enable_key_rotation     = true
  deletion_window_in_days = 7

  tags = {
    Name = "dynamodb_kms_key"
  }
}
