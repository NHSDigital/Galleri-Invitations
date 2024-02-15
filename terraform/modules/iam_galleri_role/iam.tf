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

# Policy required by gpPracticesLoaderLambda
#resource "aws_iam_policy" "gp_practice_loader_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_gp_practices_loader_lambda_role"
#  path        = "/"
#  description = "AWS IAM Policy for loading gp practices role"
#  policy = jsonencode(
#    {
#      "Statement" : [
#        {
#          "Action" : [
#            "logs:CreateLogGroup",
#            "logs:CreateLogStream",
#            "logs:PutLogEvents"
#          ],
#          "Effect" : "Allow",
#          "Resource" : "arn:aws:logs:*:*:*"
#        },
#        {
#          "Sid" : "AllowDynamodbAccess",
#          "Effect" : "Allow",
#          "Action" : [
#            "dynamodb:*"
#          ],
#          "Resource" : [
#            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-GpPractice",
#            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Postcode"
#          ]
#        }
#      ],
#      "Version" : "2012-10-17"
#  })
#}

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

# Policy required by validateClinicDataLambda
# resource "aws_iam_policy" "iam_policy_for_validate_clinic_data_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_clinic_data_lambda_role"
# Policy required by validateCaasFeedLambda
# resource "aws_iam_policy" "iam_policy_for_validate_caas_feed_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_caas_feed_lambda_role"
#  path        = "/"
#  description = "AWS IAM Policy for pushing into S3 Bucket"
#  policy = jsonencode(
#    {
#      "Statement" : [
#        {
#          "Action" : [
#            "logs:CreateLogGroup",
#            "logs:CreateLogStream",
#            "logs:PutLogEvents"
#          ],
#          "Effect" : "Allow",
#          "Resource" : "arn:aws:logs:*:*:*"
#        },
#        {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::gtms-clinic-create-or-update/*"
#             "arn:aws:s3:::galleri-caas-data/*"
#           ]
#         }
#      ],
#      "Version" : "2012-10-17"
#  })
# }


# Added GpPractice and Postcode to this policy as lambda role exceeded policy limit
# Added validate CLinic Data to this policy as lambda role exceeded policy limit
# Added validate Caas Feed to this policy as lambda role exceeded policy limit
# Added UserAccounts to this policy as lambda role exceeded policy limit
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
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Population/*/*",
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-GpPractice",
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Postcode",
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-UserAccounts",
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-PhlebotomySite",
          ]
        },
        {
          "Sid" : "AllowS3Access",
          "Effect" : "Allow",
          "Action" : [
            "s3:*"
          ],
          "Resource" : [
            "arn:aws:s3:::${var.environment}-galleri-caas-data/*",
            "arn:aws:s3:::${var.environment}-outbound-gtms-invited-participant-batch/*",
            "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-create-or-update",
            "arn:aws:s3:::${var.environment}-inbound-gtms-clinic-create-or-update/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-clinic-schedule-summary/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-appointment/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-withdrawal/*",
          ]
        },
        {
          "Effect" : "Allow",
          "Action" : [
            "secretsmanager:GetResourcePolicy",
            "secretsmanager:GetSecretValue",
            "secretsmanager:DescribeSecret",
            "secretsmanager:ListSecretVersionIds"
          ],
          "Resource" : [
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_URL*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_SHARED_KEY_1*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:GTMS_MESH_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:GTMS_MESH_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:GTMS_MESH_CERT*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_SENDER_KEY*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_SENDER_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_SENDER_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_RECEIVER_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_RECEIVER_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_RECEIVER_KEY*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_RECEIVER_CERT*",
            "arn:aws:secretsmanager:eu-west-2:136293001324:secret:MESH_SENDER_CERT*"
          ]
        },
        {
          "Effect" : "Allow",
          "Action" : "secretsmanager:ListSecrets",
          "Resource" : "*"
        },
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
        },
        {
          "Sid" : "AllowEpisodeDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Episode"
          ]
        },
        {
          "Sid" : "AllowEpisodeQueryDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Episode/*/*"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

resource "aws_iam_policy" "iam_policy_for_create_episode_record_lambda" {
  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_create_episode_record_lambda_role"
  path        = "/"
  description = "AWS IAM Policy for managing aws lambda create episode record role"
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
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Population"
          ]
        },
        {
          "Sid" : "AllowEpisodeDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Episode"
          ]
        },
        {
          "Sid" : "AllowEpisodeQueryDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Episode/*/*"
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

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "gp_practice_loader_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.gp_practice_loader_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "validate_clinic_data_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.validate_clinic_data_lambda.arn
#resource "aws_iam_role_policy_attachment" "validate_caas_feed_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.validate_caas_feed_lambda.arn
#}

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

# resource "aws_iam_role_policy_attachment" "create_episode_record_policy" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_create_episode_record_lambda.arn
# }

# resource "aws_iam_role_policy_attachment" "secrets_lambda_policy" {
#   role       = aws_iam_role.github-oidc-invitations-role.name
#   policy_arn = aws_iam_policy.iam_policy_for_participants_in_lsoa_lambda.arn
# }

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
