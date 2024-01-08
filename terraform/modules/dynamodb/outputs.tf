output "dynamodb_table_name" {
  value = aws_dynamodb_table.dynamodb_table.name
}

output "dynamodb_hash_key" {
  value = aws_dynamodb_table.dynamodb_table.hash_key
}

output "dynamodb_stream_arn" {
  value = aws_dynamodb_table.dynamodb_table.stream_arn
}
