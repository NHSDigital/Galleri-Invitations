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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite"
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
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-GpPractice",
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Postcode"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-ParticipatingIcb"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-InvitationParameters"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-InvitationParameters"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-InvitationParameters"
          ]
        },
        {
          "Sid" : "AllowLambdaInvoke",
          "Effect" : "Allow",
          "Action" : [
            "lambda:*"
          ],
          "Resource" : [
            "arn:aws:lambda:eu-west-2:${var.account_id}:function:${var.environment}-getLsoaParticipantsLambda"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-UniqueLsoa"
          ]
        },
        {
          "Sid" : "AllowLambdaInvoke",
          "Effect" : "Allow",
          "Action" : [
            "lambda:*"
          ],
          "Resource" : [
            "arn:aws:lambda:eu-west-2:${var.account_id}:function:${var.environment}-getLsoaParticipantsLambda"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

# Policy required by validateClinicDataLambda
# resource "aws_iam_policy" "iam_policy_for_validate_clinic_data_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_clinic_data_lambda_role"

# Policy required by validateClinicCapacityLambda
# resource "aws_iam_policy" "iam_policy_for_validate_clinic_capacity_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_clinic_capacity_lambda_role"

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
#             "arn:aws:s3:::${var.environment}-inbound-gtms-clinic-create-or-update/*",
#             "arn:aws:s3:::${var.environment}-galleri-caas-data/*",
#           ]
#         }
#      ],
#      "Version" : "2012-10-17"
#  })
# }

# # Policy required by sendGTMSInvitationBatchLambda
# resource "aws_iam_policy" "iam_policy_for_send_gtms_invitation_batch_lambda" {
#  name        = "${var.environment}-aws_iam_policy_for_terraform_aws_send_gtms_invitation_batch_lambda_role"
#  path        = "/"
#  description = "AWS IAM Policy for allowing permission to work with S3 bucket and get secrets from Secrets manager"
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
#             "arn:aws:s3:::${var.environment}-outbound-gtms-invited-participant-batch/*",
#             "arn:aws:s3:::${var.environment}-sent-gtms-invited-participant-batch",
#           ]
#         },
#         {
#           "Effect" : "Allow",
#           "Action" : [
#             "secretsmanager:GetResourcePolicy",
#             "secretsmanager:GetSecretValue",
#             "secretsmanager:DescribeSecret",
#             "secretsmanager:ListSecretVersionIds"
#           ],
#           "Resource" : [
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_URL*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SHARED_KEY_1*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_MAILBOX_ID*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_MAILBOX_PASSWORD*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_CERT*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_KEY*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_MAILBOX_ID*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_MAILBOX_PASSWORD*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_MAILBOX_ID*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_MAILBOX_PASSWORD*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_KEY*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_CERT*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_CERT*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CIS2_INT_1*"
#           ]
#         }
#      ],
#      "Version" : "2012-10-17"
#  })
# }


# resource "aws_iam_policy" "iam_policy_for_caas_feed_delete_records_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_caas_feed_delete_records_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for deleting records from caas feed"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::${var.environment}-galleri-processed-caas-data/*",
#           ]
#         },
#         {
#          "Sid" : "AllowDynamodbAccess",
#          "Effect" : "Allow",
#          "Action" : [
#            "dynamodb:*"
#          ],
#          "Resource" : [
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population",
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Appointments"
#          ]
#        },
#       ],
#       "Version" : "2012-10-17"
#   })
# }


# Added GpPractice and Postcode to this policy as lambda role exceeded policy limit
# Added validate CLinic Data to this policy as lambda role exceeded policy limit
# Added validate CLinic Capacity to this policy as lambda role exceeded policy limit
# Added validate Caas Feed to this policy as lambda role exceeded policy limit
# Added Sending Invitaiton batch to GTMS to this plicy as lambda role exceeded policy limit
# Added UserAccounts to this policy as lambda role exceeded policy limit
# Added addEpisodeHistory to this policy as lambda role exceeded policy limit
# Added caasFeedDeleteRecords to this policy as lambda role exceeded policy limit
# Added gtms upload clinic capacity data to this policy as lambda role exceeded policy limit
# Added validateGtmsAppointment to this policy as lambda role exceeded policy limit
# Added gtmsStatusUpdateLambda to this policy as lambda role exceeded policy limit
# Added caasFeedAdd to this policy as lambda role exceeded policy limit
# Added validateAppointmentCommonDataLambda to this policy as lambda role exceeded policy limit
# Added appointmentEventCancelledLambda to this policy as lambda role exceeded policy limit
# Added processAppointmentEventTypeLambda to this policy as lambda role exceeded policy limit
# Added sendInvitationBatchToRawMessageQueueLambda to this policy as lambda role exceeded policy limit
# Added sendEnrichedMessageToNotifyQueueLambda to this policy as lambda role exceeded policy limit
# Added sendSingleNotifyMessageLambda to this policy as lambda role exceeded policy limit
# Added nrdsMeshMailboxLambda to this policy as lambda role exceeded policy limit
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population/*/*",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-GpPractice",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Postcode",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-UserAccounts",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Appointments",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite/*/*",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Appointments/*/*",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-EpisodeHistory",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Episode",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-EpisodeHistory/*/*",
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-NotifySendMessageStatus"
          ]
        },
        {
          "Sid" : "AllowS3Access",
          "Effect" : "Allow",
          "Action" : [
            "s3:*"
          ],
          "Resource" : [
            "arn:aws:s3:::galleri-clinic-data/*",
            "arn:aws:s3:::galleri-clinic-capacity/*",
            "arn:aws:s3:::${var.environment}-outbound-gtms-invited-participant-batch/*",
            "arn:aws:s3:::${var.environment}-galleri-caas-data/*",
            "arn:aws:s3:::${var.environment}-invalid-gtms-payload/*",
            "arn:aws:s3:::${var.environment}-outbound-gtms-invited-participant-batch/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-appointment/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-appointment-validated/*",
            "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-create-or-update",
            "arn:aws:s3:::${var.environment}-inbound-gtms-clinic-create-or-update/*",
            "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-create-or-update/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-clinic-schedule-summary/*",
            "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-schedule-summary/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-appointment/*",
            "arn:aws:s3:::${var.environment}-inbound-gtms-withdrawal/*",
            "arn:aws:s3:::${var.environment}-gps-public-keys-bucket/*",
            "arn:aws:s3:::${var.environment}-gps-public-keys-bucket",
            "arn:aws:s3:::${var.environment}-gp-practices-bucket/*",
            "arn:aws:s3:::${var.environment}-processed-inbound-gtms-withdrawal/*",
            "arn:aws:s3:::${var.environment}-sent-gtms-invited-participant-batch/*",
            "arn:aws:s3:::${var.environment}-galleri-processed-caas-data/*",
            "arn:aws:s3:::${var.environment}-proccessed-appointments/*",
            "arn:aws:s3:::${var.environment}-inbound-processed-nrds-data/*",
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
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_URL*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SHARED_KEY_1*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_RECEIVER_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:GTMS_MESH_CERT*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_KEY*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_KEY*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_RECEIVER_CERT*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SENDER_CERT*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CAAS_MESH_MAILBOX_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CAAS_MESH_MAILBOX_PASSWORD*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CAAS_MESH_CERT*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CIS2_INT_1*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:CIS2_CLIENT_ID*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:NHS_NOTIFY_API_KEY*",
            "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:COMMS_MANAGER_PRIVATE_KEY_TEST_1*"
          ]
        },
        {
          "Effect" : "Allow",
          "Action" : "secretsmanager:ListSecrets",
          "Resource" : "*"
        },
        {
          "Action" : [
            "sqs:SendMessage",
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
          ],
          "Effect" : "Allow",
          "Resource" : [
            "arn:aws:sqs:eu-west-2:${var.account_id}:${var.environment}-notifyRawMessageQueue.fifo",
            "arn:aws:sqs:eu-west-2:${var.account_id}:${var.environment}-notifyEnrichedMessageQueue.fifo",
          ]
        },
        {
          "Action" : [
            "sqs:SendMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes"
          ],
          "Effect" : "Allow",
          "Resource" : [
            "arn:aws:sqs:eu-west-2:${var.account_id}:${var.environment}-notifyEnrichedMessageQueue.fifo",
          ]
        },
        {
          "Action" : "ssm:GetParameter",
          "Effect" : "Allow",
          "Resource" : "arn:aws:ssm:eu-west-2:${var.account_id}:parameter/*"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite"
          ]
        },
        {
          "Sid" : "AllowPopulationDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population"
          ]
        },
        {
          "Sid" : "AllowEpisodeDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Episode"
          ]
        },
        {
          "Sid" : "AllowEpisodeQueryDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Episode/*/*"
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
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population"
          ]
        },
        {
          "Sid" : "AllowEpisodeDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Episode"
          ]
        },
        {
          "Sid" : "AllowEpisodeQueryDynamodbAccess",
          "Effect" : "Allow",
          "Action" : [
            "dynamodb:*"
          ],
          "Resource" : [
            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Episode/*/*"
          ]
        }
      ],
      "Version" : "2012-10-17"
  })
}

# Policy required by sendInvitationBatchToRawMessageQueueLambda
# resource "aws_iam_policy" "iam_policy_for_send_invitation_batch_to_raw_message_queue_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_send_invitation_batch_to_raw_message_queue_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for managing aws lambda send invitation batch to raw message queue role"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Action" : [
#             "sqs:SendMessage"
#           ],
#           "Effect" : "Allow",
#           "Resource" : [
#           "arn:aws:sqs:eu-west-2:${var.account_id}:${var.environment}-notifyRawMessageQueue.fifo",
#         ]
#       }
#       ],
#       "Version" : "2012-10-17"
#   })
# }


# Policy required by nrdsMeshMailboxLambda
# resource "aws_iam_policy" "iam_policy_for_nrdsMeshMailboxLambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_nrdsMeshMailboxLambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for managing aws lambda nrdsMeshMailboxLambda"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#           "s3:*"
#           ],
#           "Resource" : [
#           "arn:aws:s3:::${var.environment}-inbound-processed-nrds-data/*",
#           ]
#         },
#         {
#           "Effect" : "Allow",
#           "Action" : [
#             "secretsmanager:GetResourcePolicy",
#             "secretsmanager:GetSecretValue",
#             "secretsmanager:DescribeSecret",
#             "secretsmanager:ListSecretVersionIds"
#           ],
#           "Resource" : [
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:MESH_SHARED_KEY_1*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:SAND_MESH_MAILBOX_ID*",
#             "arn:aws:secretsmanager:eu-west-2:${var.account_id}:secret:SAND_MESH_MAILBOX_PASSWORD*",
#           ]
#         },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# Policy required by addEpisodeHistory
# resource "aws_iam_policy" "iam_policy_for_add_episode_history_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_add_episode_history_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for managing aws lambda create episode record role"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowEpisodeDynamodbAccess",
#           "Effect" : "Allow",
#           "Action" : [
#             "dynamodb:*"
#           ],
#           "Resource" : [
#             "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Episode"
#           ]
#         },
#         {
#           "Sid" : "AllowEpisodeHistoryDynamodbAccess",
#           "Effect" : "Allow",
#           "Action" : [
#             "dynamodb:*"
#           ],
#           "Resource" : [
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-EpisodeHistory"
#           ]
#         },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# resource "aws_iam_policy" "iam_policy_for_gtms_upload_clinic_capacity_data_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_gtms_upload_clinic_capacity_data_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for managing aws lambda gtms upload clinic capacity role"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowPhlebotomySiteDynamodbAccess",
#           "Effect" : "Allow",
#           "Action" : [
#             "dynamodb:*"
#           ],
#           "Resource" : [
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-PhlebotomySite/*/*"
#           ]
#         },
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#         {
#             "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-create-or-update/*",
#             "arn:aws:s3:::${var.environment}-processed-inbound-gtms-clinic-schedule-summary/*",
#           ]
#         }
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# resource "aws_iam_policy" "iam_policy_for_validate_gtms_appointment_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_gtms_appointment_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for validating gtms appointment lambda"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {

#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::${var.environment}-inbound-gtms-appointment/*",
#             "arn:aws:s3:::${var.environment}-inbound-gtms-appointment-validated/*",
#           ]
#         },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# # Policy required by caasFeedAddRecordsLambda
# resource "aws_iam_policy" "iam_policy_for_caas_feed_add_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_caas_feed_add_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for caas feed add lambda"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::${var.environment}-galleri-processed-caas-data/*",
#           ]
#         },
#         {
#           "Sid" : "AllowDyanmodbAccess",
#           "Effect" : "Allow",
#           "Action" : [
#             "dynamodb:*"
#           ],
#           "Resource" : [
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population"
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population/*/*",
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Postcode"
#             "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-GpPractice"
#           ]
#         },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# # Policy required by processAppointmentEventTypeLambda
# resource "aws_iam_policy" "iam_policy_for_process_appointment_event_type_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_process_appointment_event_type_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for caas feed add lambda"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::${var.environment}-proccessed-appointments/*",
#           ]
#         },
#         {
#           "Sid" : "AllowDyanmodbAccess",
#           "Effect" : "Allow",
#           "Action" : [
#             "dynamodb:*"
#           ],
#           "Resource" : [
#             "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Appointments/*/*"
#             "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Population/*/*",
#             "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-Postcode"
#             "arn:aws:dynamodb:eu-west-2:136293001324:table/${var.environment}-GpPractice"
#           ]
#         },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

# resource "aws_iam_policy" "iam_policy_for_validate_appointment_common_data_lambda" {
#   name        = "${var.environment}-aws_iam_policy_for_terraform_aws_validate_appointment_common_data_lambda_role"
#   path        = "/"
#   description = "AWS IAM Policy for validating appointment common data"
#   policy = jsonencode(
#     {
#       "Statement" : [
#         {
#           "Action" : [
#             "logs:CreateLogGroup",
#             "logs:CreateLogStream",
#             "logs:PutLogEvents"
#           ],
#           "Effect" : "Allow",
#           "Resource" : "arn:aws:logs:*:*:*"
#         },
#         {
#           "Sid" : "AllowS3Access",
#           "Effect" : "Allow",
#           "Action" : [
#             "s3:*"
#           ],
#           "Resource" : [
#             "arn:aws:s3:::${var.environment}-galleri-processed-caas-data/*",
#           ]
#         },
#         {
#          "Sid" : "AllowDynamodbAccess",
#          "Effect" : "Allow",
#          "Action" : [
#            "dynamodb:*"
#          ],
#          "Resource" : [
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Population",
#            "arn:aws:dynamodb:eu-west-2:${var.account_id}:table/${var.environment}-Appointments"
#          ]
#        },
#       ],
#       "Version" : "2012-10-17"
#   })
# }

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
#}

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "validate_clinic_capacity_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.validate_clinic_capacity_lambda.arn

#resource "aws_iam_role_policy_attachment" "validate_caas_feed_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.iam_policy_for_validate_caas_feed_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "send_gtms_invitation_batch_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.iam_policy_for_send_gtms_invitation_batch_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "caas_feed_delete_records_lambda" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_caas_feed_delete_records_lambda.arn

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "caas_feed_add_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.iam_policy_for_caas_feed_add_lambda.arn
# }

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

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "send_invitation_batch_to_raw_message_queue_lambda_policy" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_send_invitation_batch_to_raw_message_queue_lambda.arn
# }

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "create_episode_record_policy" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_create_episode_record_lambda.arn
# }

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "validate_gtms_appointment_lambda" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_validate_gtms_appointment_lambda.arn
# }

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "process_appointment_event_type_lambda" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_process_appointment_event_type_lambda.arn
# }

# resource "aws_iam_role_policy_attachment" "secrets_lambda_policy" {
#   role       = aws_iam_role.github-oidc-invitations-role.name
#   policy_arn = aws_iam_policy.iam_policy_for_participants_in_lsoa_lambda.arn
# }

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "gp_practice_loader_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.gp_practice_loader_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "add_episode_history_policy" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_add_episode_history_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "validate_clinic_data_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.validate_clinic_data_lambda.arn

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "validate_caas_feed_lambda" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.validate_caas_feed_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
#resource "aws_iam_role_policy_attachment" "gtms_upload_clinic_capacity_data" {
#  role       = aws_iam_role.galleri_lambda_role.name
#  policy_arn = aws_iam_policy.iam_policy_for_gtms_upload_clinic_capacity_data_lambda.arn
#}

# Role exceeded quota for PoliciesPerRole: 10
# resource "aws_iam_role_policy_attachment" "validate_appointment_common_data_lambda" {
#   role       = aws_iam_role.galleri_lambda_role.name
#   policy_arn = aws_iam_policy.iam_policy_for_validate_appointment_common_data_lambda.arn
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
