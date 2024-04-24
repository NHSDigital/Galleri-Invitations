resource "aws_sqs_queue" "sqs" {
  name                        = "${var.environment}-${var.name}"
  fifo_queue                  = var.is_fifo_queue
  content_based_deduplication = var.is_content_based_deduplication
  visibility_timeout_seconds  = var.visibility_timeout_seconds
}
