
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
    type = "S"
  }

  global_secondary_index {
    name               = "emailPhoneIndex"
    hash_key           = "emailAddressHome"
    range_key          = "telephoneNumberMobile"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["nhsNumber"]
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
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
    enabled = true
  }

  tags = {
    Name        = "dynamodb-table-gp-practice"
    Environment = "dev"
  }
}


resource "aws_dynamodb_table" "gp-practice-table" {
  name           = "gp_practice"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "gpPracticeId"
  range_key      = "gpPracticeName"

  attribute {
    name = "gpPracticeId"
    type = "S"
  }

  attribute {
    name = "gpPracticeName"
    type = "S"
  }

  attribute {
    name = "addressLine1"
    type = "S"
  }

  attribute {
    name = "postcode"
    type = "S"
  }

  global_secondary_index {
    name               = "addressLine1PostcodeIndex"
    hash_key           = "addressLine1"
    range_key          = "postcode"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["gpPracticeId"]
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "dynamodb_table_participating_icb"
    Environment = "dev"
  }
}
