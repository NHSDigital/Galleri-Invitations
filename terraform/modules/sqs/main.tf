resource "aws_sqs_queue" "sqs" {
  name                        = "${var.environment}-${var.name}"
  fifo_queue                  = var.is_fifo_queue
  content_based_deduplication = true
  delay_seconds               = 90
  max_message_size            = 2048
  message_retention_seconds   = 86400
  receive_wait_time_seconds   = 10
}
