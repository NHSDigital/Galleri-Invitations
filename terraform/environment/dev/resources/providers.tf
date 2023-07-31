terraform {
  backend "s3" {
    bucket = "galleri-github-oidc-tf-aws-tfstates"
    key    = "infra.tfstate"
    region = "eu-west-2"
  }
}

provider "aws" {
  region = "eu-west-2"
}

