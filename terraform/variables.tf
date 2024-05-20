variable "bucket_name" {
  type    = string
  default = "galleri-lambda-bucket"
}

variable "role_name" {
  type    = string
  default = "galleri-lambda-role"
}

variable "environment" {
  description = "The environment being deployed into, could be: dev, test, uat, performance or prod"
}

variable "frontend_repo_location" {
  description = "The location of the Galler-Frontend repo on the filesystem"
  default     = "/home/runner/work/Galleri-Invitations/Galleri-Invitations/Galleri-Frontend"
}

variable "USERS" {
  default = null
}

variable "CIS2_ID" {
  default     = null
  description = "The CIS2 client_id"
}

variable "CIS2_SECRET" {
  default     = null
  description = "The CIS2 client_secret"
}

variable "NEXTAUTH_SECRET" {
  default = null
}

variable "NEXTAUTH_URL" {
  default = null
}

variable "CIS2_REDIRECT_URL" {
  default = null
}

variable "GALLERI_ACTIVITY_CODE" {
  default = null
}

variable "account_id" {
  description = "account id"
}

variable "CIS2_TOKEN_ENDPOINT_URL" {
  description = "The CIS2 token endpoint URL"
}

variable "CIS2_PUBLIC_KEY_ID" {
  description = "The CIS2 public key id (kid)"
}

variable "CIS2_KNAME" {
  description = "The CIS2 private key secret name in AWS secrets manager"
}

variable "NOTIFY_API_KEY" {
  description = "The NHS Notify API Key"
}

variable "NOTIFY_TOKEN_ENDPOINT_URL" {
  description = "The NHS Notify token endpoint URL"
}

variable "NOTIFY_MESSAGES_ENDPOINT_URL" {
  description = "The NHS Notify messages endpoint URL"
}

variable "NOTIFY_PUBLIC_KEY_ID" {
  description = "The NHS Notify public key id (kid)"
}

variable "NOTIFY_KNAME" {
  description = "The NHS_NOTIFY_KNAME private key secret name in AWS secrets manager"
}

variable "region" {
  default = "eu-west-2"
}

variable "invitations_hostname" {
  description = "the dns name for the account"
}

variable "dns_zone" {
  description = "the aws account the environment is part of, eg cicd, nft, uat, etc"
}

variable "K8_URL" {
  description = "url for eks mesh service"
  default     = null
}

variable "sso_iam_role_arn" {
  description = "The IAM role that is used by users via SSO"
}

variable "alias_name" {
  description = "Name of ALB of FHIR service"
  default     = false
}

variable "alias_zone_id" {
  description = "Zone ID of ALB of FHIR service"
  default     = false
}

variable "route53_count" {
  description = "how many route53 to provision"
  default     = 1
}

variable "teams_url" {
  description = "the url for the microsoft teams endpoint"
}
