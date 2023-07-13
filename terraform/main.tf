resource "aws_dynamodb_table" "basic-dynamodb-table" {
  name           = "galleri table"
  hash_key       = "column1"

  attribute {
    name = "column1"
    type = "S"
  }
}
