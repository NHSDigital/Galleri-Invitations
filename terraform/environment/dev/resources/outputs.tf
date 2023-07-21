output "key_arn" {
  value = aws_kms_key.dynamodb_kms_key.arn
}

output "key_id" {
  value = aws_kms_key.dynamodb_kms_key.key_id
}
