resource "aws_dynamodb_table" "gp-practice-table" {
  name           = "GP practice"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "gp practice id"
  range_key      = "gp practice name"

  attribute {
    name = "gp practice id"
    type = "N"
  }

  attribute {
    name = "gp practice name"
    type = "S"
  }

  attribute {
    name = "address line 1"
    type = "S"
  }

  attribute {
    name = "postcode"
    type = "S"
  }

  ttl {
    attribute_name = "TimeToExist"
    enabled        = false
  }

  point_in_time_recovery {
    enabled = true
  }

  global_secondary_index {
    name               = "EmailPhoneIndex"
    hash_key           = "address line 1"
    range_key          = "e-mail address (home)"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["gp practice id"]
  }

  tags = {
    Name        = "dynamodb-table-gp-practice"
    Environment = "dev"
  }
}
