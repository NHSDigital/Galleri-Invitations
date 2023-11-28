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
  default     = "64bit Amazon Linux 2 v5.8.7 running Node.js 18"
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

variable "vpc_id" {

}

variable "subnet_1" {

}

variable "subnet_2" {

}
