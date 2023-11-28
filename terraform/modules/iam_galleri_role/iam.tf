resource "aws_iam_role" "galleri_lambda_role" {
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

resource "aws_iam_policy" "iam_policy_for_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowS3Access",
          "Effect" : "Allow",
          "Action" : [
            "s3:*"
          ],
          "Resource" : [
            "arn:aws:s3:::galleri-ons-data"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "clinic_information_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_clinic_information_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda clinic details role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-PhlebotomySite"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "participating_icb_list_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_participating_icb_list_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda participating icb role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-ParticipatingIcb"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "clinic_summary_list_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_clinic_summary_list_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda clinic summary role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-PhlebotomySite"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "target_percentage_lambda" {
  name        = "${var.environment}-target_percentage_lambda_policy"
  path        = "/"
  description = "AWS IAM Policy for managing lambda target percentage"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:GetItem"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-InvitationParameters"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "invitation_parameters_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_invitation_parameters_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda invitation parameter role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-InvitationParameters"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "iam_policy_for_calculate_num_to_invite_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_calculate_num_to_invite_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda calculating number of people to invite role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-InvitationParameters"
          ]
        },
        {
          "Sid" : "AllowLambdaInvoke",
          "Effect" : "Allow",
          "Action" : [
            "lambda:*"
          ],
          "Resource" : [
            "arn:aws:lambda:eu-west-2:136293001324:function:${var.environment}-getLsoaParticipantsLambda"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "iam_policy_for_get_lsoa_in_range_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_get_lsoa_in_range_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda calculating number of people to invite role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-UniqueLsoa"
          ]
        },
        {
          "Sid" : "AllowLambdaInvoke",
          "Effect" : "Allow",
          "Action" : [
            "lambda:*"
          ],
          "Resource" : [
            "arn:aws:lambda:eu-west-2:136293001324:function:${var.environment}-getLsoaParticipantsLambda"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "iam_policy_for_participants_in_lsoa_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_participants_in_lsoa_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda get participants in lsoa role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Population/*/*"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}
resource "aws_iam_policy" "iam_policy_for_generate_invites_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_generate_invites_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda generate invites role"
  policy = jsonencode(
    {
      "Statement" : [
        {
          "Action" : [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ],
          "Effect" : "Allow",
          "Resource" : "arn:aws:logs:*:*:*"
        },
        {
          "Sid" : "AllowPhlebotomySiteDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-PhlebotomySite"
          ]
        },
        {
          "Sid" : "AllowPopulationDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Population"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_role_policy_attachment" "galleri_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_lambda.arn
}

resource "aws_iam_role_policy_attachment" "clinic_information_lambda" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.clinic_information_lambda.arn
}

resource "aws_iam_role_policy_attachment" "participating_icb_list_lambda" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.participating_icb_list_lambda.arn
}

resource "aws_iam_role_policy_attachment" "clinic_summary_list_lambda" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.clinic_summary_list_lambda.arn
}

resource "aws_iam_role_policy_attachment" "target_percentage" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.target_percentage_lambda.arn
}

resource "aws_iam_role_policy_attachment" "invitation_parameters" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.invitation_parameters_lambda.arn
}

resource "aws_iam_role_policy_attachment" "get_lsoa_in_range_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_get_lsoa_in_range_lambda.arn
}

resource "aws_iam_role_policy_attachment" "participants_in_lsoa_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_participants_in_lsoa_lambda.arn
}

resource "aws_iam_role_policy_attachment" "calculate_num_to_invite_lambda_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_calculate_num_to_invite_lambda.arn
}

resource "aws_iam_role_policy_attachment" "generate_invites_policy" {
  role       = aws_iam_role.galleri_lambda_role.name
  policy_arn = aws_iam_policy.iam_policy_for_generate_invites_lambda.arn
}


resource "aws_iam_role" "api_gateway_logging_role" {
  name = "${var.environment}-galleri_logging_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_policy" "api_gateway_logging_policy" {
  name        = "${var.environment}-galleri_logging_policy"
  path        = "/"
  description = "API Gateway Logging Policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents",
        ],
        Resource = "*"
      },
    ]
  })
}
resource "aws_iam_role_policy_attachment" "api_gateway_logging_attach" {
  role       = aws_iam_role.api_gateway_logging_role.name
  policy_arn = aws_iam_policy.api_gateway_logging_policy.arn
}

resource "aws_api_gateway_account" "account" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_logging_role.arn
}

