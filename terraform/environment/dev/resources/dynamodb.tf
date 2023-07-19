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
    name = "superseded by nhs number "
    type = "N"
  }

  attribute {
    name = "primary care provider"
    type = "S"
  }
  attribute {
    name = "primary care provider business effective from date "
    type = "S"
  }

 attribute {
    name = "current posting"
    type = "S"
  }

 attribute {
    name = "current posting business effective from date"
    type = "S"
  }
  attribute {
    name = "previous posting"
    type = "S"
  }

  attribute {
    name = "previous posting business effective from date"
    type = "N"
  }

  attribute {
    name = "name prefix"
    type = "S"
  }

  attribute {
    name = "given name"
    type = "S"
  }

  attribute {
    name = "other given name(s)"
    type = "S"
  }

  attribute {
    name = "family name"
    type = "S"
  }

  attribute {
    name = "previous family name"
    type = "S"
  }

  attribute {
    name = "date of birth"
    type = "N"
  }

  attribute {
    name = "gender"
    type = "N"
  }

  attribute {
    name = "address line 1"
    type = "S"
  }

  attribute {
    name = "address line 2"
    type = "S"
  }

    attribute {
    name = "address line 3"
    type = "S"
  }

    attribute {
    name = "address line 4"
    type = "S"
  }

    attribute {
    name = "address line 5"
    type = "S"
  }

  attribute {
    name = "postcode"
    type = "S"
  }

  attribute {
    name = "paf key"
    type = "S"
  }


  attribute {
    name = "usual address business effective from date"
    type = "N"
  }

  attribute {
    name = "reason for removal"
    type = "S"
  }

  attribute {
    name = "reason for removal effective from date"
    type = "N"
  }

  attribute {
    name = "date of death (formal)"
    type = "N"
  }

  attribute {
    name = "telephone number (home)"
    type = "S"
  }

  attribute {
    name = "telephone number (home) business effective from date"
    type = "N"
  }

  attribute {
    name = "telephone number (mobile)"
    type = "S"
  }

  attribute {
    name = "telephone number (mobile) business effective from date"
    type = "N"
  }
  attribute {
    name = "e-mail address (home)"
    type = "S"
  }

  attribute {
    name = "e-mail address (home) business effective from date"
    type = "N"
  }

  attribute {
    name = "preferred language"
    type = "S"
  }

  attribute {
    name = "interpreter required"
    type = "B"
  }

  attribute {
    name = "invalid flag"
    type = "S"
  }

  ttl {
    attribute_name = "TimeToExist"
    enabled        = false
  }

  global_secondary_index {
    name               = "NameIndex"
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
