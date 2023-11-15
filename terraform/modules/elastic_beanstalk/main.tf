data "archive_file" "screens" {
  type = "zip"

  source_dir  = var.frontend_repo_location
  output_path = "${path.cwd}/src/${var.name}.zip"
}

resource "aws_s3_bucket" "screens" {
  bucket = "${var.environment}-${var.name}-frontend"
}

resource "aws_s3_object" "screens" {
  bucket = aws_s3_bucket.screens.id
  key    = "${var.name}.zip"
  source = data.archive_file.screens.output_path
}

resource "aws_elastic_beanstalk_application" "screens" {
  name        = "${var.environment}-${var.name}"
  description = var.description
}

resource "aws_elastic_beanstalk_application_version" "screens" {
  name        = var.version
  application = aws_elastic_beanstalk_application.screens.name
  bucket      = aws_s3_bucket.screens.bucket
  key         = aws_s3_object.screens.key
}

resource "aws_elastic_beanstalk_environment" "screens" {
  name                = "${var.environment}-${var.name}"
  application         = aws_elastic_beanstalk_application.screens.name
  solution_stack_name = var.solution_stack_name # Change to your desired platform
  version_label       = aws_elastic_beanstalk_application_version.screens.name

  setting {
    namespace = var.namespace
    name      = var.settings_name
    value     = var.instance_type # Change to 'LoadBalanced' if needed
  }

  # Add more settings as required
}
