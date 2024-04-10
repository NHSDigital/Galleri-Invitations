# resource "aws_lambda_permission" "allow_bucket" {
#   statement_id  = "AllowExecutionFromS3Bucket"
#   action        = "lambda:InvokeFunction"
#   function_name = var.name
#   principal     = "s3.amazonaws.com"
#   source_arn    = var.bucket_arn
# }

resource "aws_lambda_permission" "allow_bucket" {
  for_each = local.unique_lambda_arns

  statement_id  = "AllowExecution-${md5(each.value)}"
  action        = "lambda:InvokeFunction"
  function_name = each.value
  principal     = "s3.amazonaws.com"
  source_arn    = var.bucket_arn
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = var.bucket_id

  dynamic "lambda_function" {
    for_each = var.triggers
    content {
      lambda_function_arn = lambda_function.value.lambda_arn
      events              = lambda_function.value.bucket_events
      filter_prefix       = lambda_function.value.filter_prefix
      filter_suffix       = lambda_function.value.filter_suffix
    }
  }

  depends_on = [aws_lambda_permission.allow_bucket]
}

# resource "aws_s3_bucket_notification" "bucket_notification" {
#   bucket = var.bucket_id

#   lambda_function {
#     lambda_function_arn = var.lambda_arn
#     events              = ["${var.bucket_events}"]
#     filter_prefix       = var.filter_prefix
#     filter_suffix       = var.filter_suffix
#   }

#   depends_on = [aws_lambda_permission.allow_bucket]
# }

