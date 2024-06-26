resource "aws_s3_bucket" "bucket" {
  bucket        = "${var.environment}-${var.bucket_name}"
  force_destroy = true
  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment} ${var.bucket_name} Bucket"
  }
}

resource "aws_s3_bucket_public_access_block" "block_public_access" {
  bucket = aws_s3_bucket.bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "allow_access_to_lambda" {
  # bucket = "galleri-ons-data"
  bucket = "${var.environment}-${var.bucket_name}"
  policy = data.aws_iam_policy_document.allow_access_to_lambda.json
}

data "aws_iam_policy_document" "allow_access_to_lambda" {
  statement {
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::${var.account_id}:role/github-oidc-invitations-role",
        var.galleri_lambda_role_arn
      ]
    }

    actions = [
      "s3:*"
    ]

    resources = [
      "arn:aws:s3:::${var.environment}-${var.bucket_name}/*"
    ]
  }
}

resource "aws_s3_bucket_versioning" "bucket_versioning" {
  bucket = "${var.environment}-${var.bucket_name}"
  versioning_configuration {
    status = "Enabled"
  }
}
