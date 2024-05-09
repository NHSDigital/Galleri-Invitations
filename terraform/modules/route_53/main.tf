data "aws_route53_zone" "example" {
  name         = var.hostname
  private_zone = false
}

resource "aws_acm_certificate" "certificate" {
  domain_name       = "fhir.${var.environment}.cicd-gps-multi-cancer-blood-test.nhs.uk"
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
  name    = aws_acm_certificate.certificate.domain_name
  type    = "CNAME"
  ttl     = 300
  records = ["${var.environment}.fhir.cicd-gps-multi-cancer-blood-test.nhs.uk"]


  allow_overwrite = true
  zone_id         = data.aws_route53_zone.example.zone_id
}

resource "aws_acm_certificate_validation" "example" {
  certificate_arn         = aws_acm_certificate.certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.route_record : record.fqdn] //unsure about fqdn
}

resource "aws_route53_record" "actual_record" {
  zone_id = data.aws_route53_zone.example.id
  name    = aws_acm_certificate.certificate.domain_name
  type    = "CNAME"
  ttl     = "300"
  records = ["${var.environment}-${var.dns_zone}-gps-multi-cancer-blood-test.${var.region}.nginx.com"]
}
