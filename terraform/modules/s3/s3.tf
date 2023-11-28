resource "aws_s3_bucket" "bucket" {
  bucket        = "${var.environment}-${var.bucket_name}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "block_public_access" {
  bucket = aws_s3_bucket.bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "allow_access_to_lambda" {
<<<<<<< HEAD
  bucket = aws_s3_bucket.bucket.bucket
=======
  bucket = aws_s3_bucket.bucket.id
>>>>>>> c13662c (AC - updated main file to prevent loops with db updates)
  policy = data.aws_iam_policy_document.allow_access_to_lambda.json
}

data "aws_iam_policy_document" "allow_access_to_lambda" {
  statement {
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::136293001324:role/github-oidc-invitations-role",
        var.galleri_lambda_role_arn
      ]
    }

    actions = [
      "s3:*"
    ]

    resources = [
      "arn:aws:s3:::galleri-ons-data/*"
    ]
  }
}
