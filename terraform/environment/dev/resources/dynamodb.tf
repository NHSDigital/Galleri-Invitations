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
    name            = "EmailPhoneIndex"
    hash_key        = "EmailAddressHome"
    range_key       = "TelephoneNumberMobile"
    write_capacity  = 10
    read_capacity   = 10
    projection_type = "KEYS_ONLY"
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
    name            = "AddressLine1PostcodeIndex"
    hash_key        = "AddressLine1"
    range_key       = "Postcode"
    write_capacity  = 10
    read_capacity   = 10
    projection_type = "KEYS_ONLY"
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

resource "aws_dynamodb_table" "phlebotomy_site_table" {
  name           = "PhlebotomySite"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "ClinicId"
  range_key      = "ClinicName"

  attribute {
    name = "ClinicId"
    type = "S"
  }

  attribute {
    name = "ClinicName"
    type = "S"
  }

  attribute {
    name = "Postcode"
    type = "S"
  }

  global_secondary_index {
    name            = "ClinicIdPostcodeIndex"
    hash_key        = "ClinicId"
    range_key       = "Postcode"
    write_capacity  = 10
    read_capacity   = 10
    projection_type = "KEYS_ONLY"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Phlebotomy Site"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "imd_table" {
  name           = "Imd"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "LsoaCode"
  range_key      = "LsoaName"

  attribute {
    name = "LsoaCode"
    type = "S"
  }

  attribute {
    name = "LsoaName"
    type = "S"
  }

  attribute {
    name = "ImdRank"
    type = "N"
  }

  global_secondary_index {
    name            = "ImdRankImdDecileIndex"
    hash_key        = "ImdRank"
    range_key       = "LsoaName"
    write_capacity  = 10
    read_capacity   = 10
    projection_type = "KEYS_ONLY"
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

resource "aws_dynamodb_table" "population_table" {
  name           = "Population"
  billing_mode   = "PROVISIONED"
  read_capacity  = 20
  write_capacity = 20
  hash_key       = "PersonId"
  range_key      = "LsoaCode"

  attribute {
    name = "PersonId"
    type = "S"
  }

  attribute {
    name = "LsoaCode"
    type = "S"
  }

  global_secondary_index {
    name            = "LsoaCode-index"
    hash_key        = "LsoaCode"
    write_capacity  = 10
    read_capacity   = 10
    non_key_attributes = ["Invited"]
    projection_type = "INCLUDE"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Population"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "Postcode_table" {
  name         = "Postcode"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "POSTCODE"
  range_key    = "IMD_RANK"

  attribute {
    name = "POSTCODE"
    type = "S"
  }

  attribute {
    name = "IMD_RANK"
    type = "N"
  }

  attribute {
    name = "IMD_DECILE"
    type = "N"
  }

  global_secondary_index {
    name            = "POSTCODE"
    hash_key        = "IMD_RANK"
    range_key       = "IMD_DECILE"
    projection_type = "KEYS_ONLY"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Postcode"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "LSOA_table" {
  name         = "UniqueLsoa"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LSOA_2011"

  attribute {
    name = "LSOA_2011"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table LSOA"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table" "Invitation_parameters" {
  name           = "InvitationParameters"
  billing_mode   = "PROVISIONED"
  read_capacity  = 10
  write_capacity = 10
  hash_key       = "CONFIG_ID"

  attribute {
    name = "CONFIG_ID"
    type = "N"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "Dynamodb Table Invitation Parameters"
    Environment = "dev"
  }
}

resource "aws_dynamodb_table_item" "quintileTargets" {
  table_name = aws_dynamodb_table.Invitation_parameters.name
  hash_key   = aws_dynamodb_table.Invitation_parameters.hash_key

  item = <<ITEM
{
  "CONFIG_ID": {"N": "001"},
  "QUINTILE_1": {"N": "20"},
  "QUINTILE_2": {"N": "20"},
  "QUINTILE_3": {"N": "20"},
  "QUINTILE_4": {"N": "20"},
  "QUINTILE_5": {"N": "20"},
  "FORECAST_UPTAKE": {"N": "50"},
  "TARGET_PERCENTAGE": {"N": "50"}
}
ITEM
}
