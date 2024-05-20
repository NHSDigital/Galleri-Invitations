data "aws_route53_zone" "example" {
  name         = var.hostname
  private_zone = false
}

resource "aws_acm_certificate" "certificate" {
  domain_name       = "${var.environment}.fhir.${var.dns_zone}-gps-multi-cancer-blood-test.nhs.uk"
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
  validation_record_fqdns = [for record in aws_route53_record.route_record : record.fqdn]
}

resource "aws_route53_record" "actual_record" {
  count   = var.alias_name ? true : false
  zone_id = data.aws_route53_zone.example.id
  name    = aws_acm_certificate.certificate.domain_name
  type    = "A"
  alias {
    name                   = var.alias_name
    zone_id                = var.alias_zone_id
    evaluate_target_health = true
  }
}
