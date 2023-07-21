resource "aws_dynamodb_table" "sdrs-table" {
  name           = "SDRS"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "nhsNumber"
  range_key      = "givenName"

  attribute {
    name = "nhsNumber"
    type = "N"
  }

  attribute {
    name = "givenName"
    type = "S"
  }

  attribute {
    name = "telephoneNumberMobile"
    type = "S"
  }

  attribute {
    name = "emailAddressHome"
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
    hash_key           = "emailAddressHome"
    range_key          = "telephoneNumberMobile"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["nhsNumber"]
  }

  tags = {
    Name        = "dynamodb-table-sdrs"
    Environment = "dev"
  }
}

