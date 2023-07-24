resource "aws_dynamodb_table" "sdrs_table" {
  name           = "Sdrs"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "NhsNumber"
  range_key      = "GivenName"

  attribute {
    name = "NhsNumber"
    type = "N"
  }

  attribute {
    name = "GivenName"
    type = "S"
  }

  attribute {
    name = "TelephoneNumberMobile"
    type = "S"
  }

  attribute {
    name = "EmailAddressHome"
    type = "S"
  }

  global_secondary_index {
    name               = "EmailPhoneIndex"
    hash_key           = "EmailAddressHome"
    range_key          = "TelephoneNumberMobile"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["NhsNumber"]
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Sdrs"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "participating_icb_table" {
  name           = "ParticipatingIcb"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "IcbCode"

  attribute {
    name = "IcbCode"
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
    Name        = "Dynamodb Table Participating Icb"
    Environment = "dev"
  }
}


resource "aws_dynamodb_table" "gp_practice_table" {
  name           = "GpPractice"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "GpPracticeId"
  range_key      = "GpPracticeName"

  attribute {
    name = "GpPracticeId"
    type = "S"
  }

  attribute {
    name = "GpPracticeName"
    type = "S"
  }

  attribute {
    name = "AddressLine1"
    type = "S"
  }

  attribute {
    name = "Postcode"
    type = "S"
  }

  global_secondary_index {
    name               = "AddressLine1PostcodeIndex"
    hash_key           = "AddressLine1"
    range_key          = "Postcode"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["GpPracticeId"]
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Gp Practice"
    Environment = "dev"
  }
}

  resource "aws_dynamodb_table" "imb_table" {
  name           = "imd"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "imdId"
  range_key      = "imdName"

  attribute {
    name = "imdId"
    type = "S"
  }

  attribute {
    name = "participantId"
    type = "S"
  }

  attribute {
    name = "imdScore"
    type = "S"
  }

  global_secondary_index {
    name               = "imdIndex"
    hash_key           = "imdId"
    range_key          = "participantId"
    write_capacity     = 10
    read_capacity      = 10
    projection_type    = "INCLUDE"
    non_key_attributes = ["ImdId"]
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Imd"
    Environment = "dev"
  }
}
