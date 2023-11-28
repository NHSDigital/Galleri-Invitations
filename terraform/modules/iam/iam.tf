
resource "aws_iam_role" "iam_role" {
  name = "${var.environment}-${var.role_name}"

  assume_role_policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Allow",
        "Principal" : {
          "Service" : "lambda.amazonaws.com"
        },
        "Action" : "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_policy" "iam_policy" {
  name        = "${var.environment}-${var.name}"
  path        = var.path
  description = var.description

  policy = var.policy
}

resource "aws_iam_role_policy_attachment" "attach_policy" {
  role       = aws_iam_role.iam_role
  policy_arn = aws_iam_policy.iam_policy.arn
}
