resource "aws_kms_key" "my_kms_key" {
  description             = "My KMS Keys for Data Encryption"
  is_enabled              = true
  enable_key_rotation     = true
  deletion_window_in_days = 7

  tags = {
    Name = "my_kms_key"
  }
}
