data "aws_route53_zone" "example" {
  name         = var.hostname
  private_zone = false
}

resource "aws_acm_certificate" "certificate" {
  domain_name       = "${var.environment}.fhir.cicd-gps-multi-cancer-blood-test.nhs.uk"
  validation_method = "DNS"

  tags = {
    ApplicationRole = "${var.application_role}"
    Name            = "${var.environment}-fhir-cert"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "route_record" {
  for_each = {
    for dvo in aws_acm_certificate.certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.example.zone_id
}

resource "aws_acm_certificate_validation" "example" {
  certificate_arn         = aws_acm_certificate.certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.route_record : record.fqdn] //unsure about fqdn
}

# data "kubernetes_service" "backend" {
#   metadata {
#     name = "backend-service"
#   }
# }

# data "aws_elb_hosted_zone_id" "this" {}

# data "aws_lb" "test" {
#   # arn  = var.lb_arn
#   name = "ab0e68c6f28554ee2b0c1d74f96035dd"
# }

variable "alb_name" {
  type    = string
  default = ""
}

resource "aws_route53_record" "actual_record" {
  zone_id = data.aws_route53_zone.example.id
  name    = aws_acm_certificate.certificate.domain_name
  type    = "CNAME"
  # ttl     = "300"
  # records = ["${var.environment}-${var.dns_zone}-gps-multi-cancer-blood-test.${var.region}.nginx.com"]
  # records = ["dev-7.fhir.cicd-gps-multi-cancer-blood-test.nhs.uk"]
  alias {
    # name                   = data.kubernetes_service.backend.status.0.load_balancer.0.ingress.0.hostname
    # name                   = data.aws_elb_hosted_zone_id.this.dns_name
    # name                   = "ab0e68c6f28554ee2b0c1d74f96035dd-102350858.eu-west-2.elb.amazonaws.com"
    # name                   = data.aws_lb.test.name
    # zone_id                = data.aws_elb_hosted_zone_id.this.zone_id ## Updated ##
    # zone_id                = data.aws_lb.test.zone_id ## Updated ##
    name    = var.alias_name
    zone_id = var.alias_zone_id
    # zone_id = data.aws_route53_zone.example.zone_id
    evaluate_target_health = false
  }
}
