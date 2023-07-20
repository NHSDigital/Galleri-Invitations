resource "aws_dynamodb_table" "participating-icb-table" {
  name           = "participating-icb"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20

  attribute {
    name = "icb code"
    type = "S"
  }

  ttl {
    attribute_name = "TimeToExist"
    enabled        = false
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
    kms_key_arn =
  }

  tags = {
    Name        = "dynamodb-table-participating-icb"
    Environment = "dev"
  }
}
