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

variable "instance_size" {
  type    = string
  default = "t3.medium"
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

variable "NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_QUINTILES" {

}

variable "NEXT_PUBLIC_CLINIC_ICB_LIST" {

}

variable "NEXT_PUBLIC_INVITATION_PARAMETERS" {

}

variable "NEXT_PUBLIC_CLINIC_INFORMATION" {

}

variable "NEXT_PUBLIC_INVITATION_PARAMETERS_PUT_FORECAST_UPTAKE" {

}

variable "NEXT_PUBLIC_PARTICIPATING_ICB_LIST" {

}

variable "NEXT_PUBLIC_CALCULATE_NUM_TO_INVITE" {

}

variable "NEXT_PUBLIC_GET_LSOA_IN_RANGE" {

}

variable "NEXT_PUBLIC_PUT_TARGET_PERCENTAGE" {

}

variable "NEXT_PUBLIC_CLINIC_SUMMARY_LIST" {

}

variable "NEXT_PUBLIC_TARGET_PERCENTAGE" {

}

variable "NEXT_PUBLIC_GENERATE_INVITES" {

}

variable "NEXT_PUBLIC_GET_USER_ROLE" {

}

variable "NEXT_PUBLIC_CIS2_SIGNED_JWT" {

}

variable "USERS" {
  description = "A list of users who can access the system via local login"
}

variable "CIS2_ID" {

}

variable "CIS2_SECRET" {
  default = "Change_Me"

}

variable "NEXTAUTH_SECRET" {
  default = "Change_Me"

}

variable "NEXTAUTH_URL" {
}

variable "GALLERI_ACTIVITY_CODE" {
}

variable "GALLERI_ACTIVITY_NAME" {
}

variable "hostname" {
}

variable "dns_zone" {

}

variable "region" {

}
