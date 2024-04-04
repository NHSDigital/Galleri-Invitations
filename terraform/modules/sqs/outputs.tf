output "sqs_queue_arn" {
  value       = aws_sqs_queue.sqs.arn
}

output "sqs_queue_url" {
  value       = aws_sqs_queue.sqs.url
}
