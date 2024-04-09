resource "aws_lambda_event_source_mapping" "dynamodb_stream_map" {
  enabled                            = var.enabled
  event_source_arn                   = var.event_source_arn
  function_name                      = var.function_name
  starting_position                  = var.starting_position
  batch_size                         = var.batch_size
  maximum_batching_window_in_seconds = var.maximum_batching_window_in_seconds

  filter_criteria {
    filter {
      pattern = jsonencode("${var.filter}")
    }
  }
}
