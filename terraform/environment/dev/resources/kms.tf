data "aws_caller_identity" "current" {}


resource "aws_kms_key" "my_kms_key" {
  description              = "My KMS Keys for Data Encryption"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  is_enabled               = true
  enable_key_rotation      = true
  deletion_window_in_days  = 7

  tags = {
    Name = "my_kms_key"
  }
}
