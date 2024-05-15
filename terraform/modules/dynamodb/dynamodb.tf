resource "aws_dynamodb_table" "dynamodb_table" {
  name             = "${var.environment}-${var.table_name}"
  billing_mode     = var.billing_mode
  read_capacity    = var.read_capacity
  write_capacity   = var.write_capacity
  hash_key         = var.hash_key
  range_key        = var.range_key
  stream_enabled   = var.stream_enabled
  stream_view_type = var.stream_view_type

  dynamic "attribute" {
    for_each = var.attributes
    content {
      name = attribute.value.name
      type = attribute.value.type
    }

  }

  dynamic "global_secondary_index" {
    for_each = var.global_secondary_index
    content {
      name               = global_secondary_index.value.name
      hash_key           = global_secondary_index.value.hash_key
      range_key          = global_secondary_index.value.range_key
      write_capacity     = var.secondary_write_capacity
      read_capacity      = var.secondary_read_capacity
      projection_type    = var.projection_type
      non_key_attributes = var.non_key_attributes
    }
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  server_side_encryption {
    enabled = var.server_side_encryption
  }

  tags = merge(
    var.tags,
    {
      ApplicationRole = "${var.application_role}"
    }
  )
}

resource "aws_backup_vault" "dynamodb_vault" {
  count = var.environment == "prod" ? 1 : 0
  name = "${var.environment[count.index]}-${var.table_name}"
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment.count.index} DynamoDB Vault"
  }
}

resource "aws_backup_plan" "dynamodb_backup_plan" {
  count = var.environment == "prod" ? 1 : 0
  name = "${var.environment}-${var.table_name}"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.dynamodb_vault[*].name
    schedule          = var.schedule
    start_window      = 120
    completion_window = 360

    lifecycle {
      delete_after = 35
    }
  }
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} DynamoDB Backup Plan"
  }
}

resource "aws_backup_selection" "dynamodb_backup_selection" {
  count = var.environment == "prod" ? 1 : 0
  name         = "${var.environment}-${var.table_name}"
  iam_role_arn = aws_iam_role.backup_role.arn
  plan_id      = aws_backup_plan.dynamodb_backup_plan[*].id

  resources = [aws_dynamodb_table.dynamodb_table.arn]
}

resource "aws_iam_role" "backup_role" {
  name = "${var.environment}-${var.table_name}-AWSBackupRole"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole",
        Principal = {
          Service = "backup.amazonaws.com"
        },
        Effect = "Allow",
      },
    ]
  })
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} DynamoDB IAM Backup Role"
  }
}

resource "aws_iam_role_policy" "backup_policy" {
  role = aws_iam_role.backup_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "dynamodb:DescribeBackup",
          "dynamodb:CreateBackup",
          "dynamodb:DeleteBackup",
          "dynamodb:ListBackups",
          "dynamodb:RestoreTableToPointInTime",
          "dynamodb:ListTables",
          "dynamodb:ListTagsOfResource",
          "dynamodb:StartAwsBackupJob"
        ],
        Effect   = "Allow",
        Resource = "*"
      },
    ]
  })
}
