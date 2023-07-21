resource "aws_dynamodb_table" "sdrs_table" {
  name           = "sdrs"
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

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb_kms_key.arn
  }

  tags = {
    Name        = "dynamodb_table_sdrs"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "participating_icb_table" {
  name           = "participating_icb"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "icbCode"

  attribute {
    name = "icbCode"
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
    enabled     = true
    kms_key_arn = aws_kms_key.dynamodb_kms_key.arn
  }

  tags = {
    Name        = "dynamodb_table_participating_icb"
    Environment = "Dev"
  }
}

