resource "aws_kms_key" "ecs" {
  description             = "${var.environment}-${var.name}"
  deletion_window_in_days = 7
}

resource "aws_cloudwatch_log_group" "ecs" {
  name = "${var.environment}-${var.name}"
}

resource "aws_ecs_cluster" "ecs" {
  name = "${var.environment}-${var.name}"

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.ecs.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs.name
      }
    }
  }
}
