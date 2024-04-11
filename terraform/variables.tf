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
  default     = "/Users/avirajmandair/Downloads/dev/Galleri-Frontend"
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

variable "GALLERI_ACTIVITY_CODE" {
  default = null
}

variable "GALLERI_ACTIVITY_NAME" {
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

variable "region" {
  default = "eu-west-2"
}

variable "invitations-hostname" {
  description = "the dns name for the account"
}

variable "dns_zone" {
  description = "the aws account the environment is part of, eg cicd, nft, uat, etc"
}
