resource "aws_iam_policy" "basic-s3-bucket-policy" {
  name        = "my-bucket-policy"
  path        = "/"
  description = "Allow "
  policy = jsonencode(
    {
  "Version" : "2012-10-17",
  "Statement" : [
    {
      "Sid" : "bucketPolicy1",
      "Effect" : "Allow",
      "Action" : [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource" : [
        "arn:aws:s3:::*/*",
        "arn:aws:s3:::basic-s3-bucket"
      ]
    }
  ]
}
  )
}

resource "aws_iam_role" "basic-s3-bucket-role" {
  name = "my_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Sid    = ""
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "basic-s3-bucket-policy" {
  role       = aws_iam_role.basic-s3-bucket-role.name
  policy_arn = aws_iam_policy.basic-s3-bucket-policy.arn
}


resource "aws_s3_bucket" "basic-s3-bucket" {
  bucket = "basic-s3-bucket"
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}
