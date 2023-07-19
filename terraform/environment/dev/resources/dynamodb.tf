resource "aws_dynamodb_table" "sdrs-table" {
  name           = "SDRS"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "nhs number"
  range_key      = "given name"

  attribute {
    name = "nhs number"
    type = "N"
  }

  attribute {
    name = "given name"
    type = "S"
  }

  attribute {
    name = "telephone number (mobile)"
    type = "S"
  }

  attribute {
    name = "e-mail address (home)"
    type = "S"
  }

  ttl {
    attribute_name = "TimeToExist"
    enabled        = false
  }

  global_secondary_index {
    name               = "EmailPhoneIndex"
    hash_key           = "e-mail address (home)"
    range_key          = "telephone number (mobile)"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["nhs number"]
  }

  tags = {
    Name        = "dynamodb-table-sdrs"
    Environment = "dev"
  }
}

