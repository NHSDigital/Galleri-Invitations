variable "environment" {
  description = "Which environment to deploy into: dev, test, uat, performance or prod"
}

variable "name" {
  description = "Name of the elastic beanstalk deployment"
}

variable "description" {
  description = "Description of the elastic beanstalk deployment"
}

variable "solution_stack_name" {
  description = "The stak that elastic beanstalk will be running on"
  default     = "64bit Amazon Linux 2 v3.3.6 running Python 3.8"
}

variable "namespace" {
  description = "The container namespace to run the application in"
  default     = "aws:elasticbeanstalk:environment"
}

variable "settings_name" {
  default = "EnvironmentType"
}

variable "instance_type" {
  description = "can be either SingleInstance or LoadBalanced"
  default     = "SingleInstance"
}

variable "frontend_repo_location" {
  description = "the filepath to the frontend repo"
}

variable "version" {
  description = "The version of the frontend"
}
