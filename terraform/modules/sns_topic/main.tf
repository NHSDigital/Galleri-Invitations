resource "aws_sns_topic" "sns_topic" {
  name                        = "${var.environment}-${var.name}"
  fifo_topic                  = var.is_fifo_topic
  content_based_deduplication = var.is_content_based_deduplication
}
