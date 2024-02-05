# Pass in the s3 bucket as a var

# resource "aws_s3_bucket" "website_bucket" {
#   bucket = "your-website-bucket-name"
#   acl    = "public-read"

#   website {
#     index_document = "index.html"
#     error_document = "error.html"
#   }
# }


# Need to tighten up permissions
resource "aws_s3_bucket_policy" "website_bucket_policy" {
  bucket = var.bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = ["s3:GetObject"]
        Effect    = "Allow"
        Resource  = "${var.bucket.arn}/*"
        Principal = "*"
      },
    ]
  })
}


resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for ${var.bucket.bucket}"
}


resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = var.bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action    = "s3:GetObject"
        Effect    = "Allow"
        Resource  = "${var.bucket.arn}/*"
        Principal = { AWS = "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${aws_cloudfront_origin_access_identity.oai.id}" }
      },
    ]
  })
}

resource "aws_cloudfront_distribution" "website_cdn" {
  origin {
    domain_name = var.bucket.website_endpoint
    origin_id   = var.bucket.id

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = ["yourdomain.com", "www.yourdomain.com"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = var.bucket.id

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  viewer_certificate {
    acm_certificate_arn = "arn:aws:acm:eu-west-2:${var.account_id}:certificate/certificate-id"
    ssl_support_method  = "sni-only"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

# If your domain is managed by AWS Route 53, you can also automate the DNS configuration
resource "aws_route53_record" "www" {
  zone_id = "your-zone-id"
  name    = "www.yourdomain.com"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website_cdn.domain_name
    zone_id                = aws_cloudfront_distribution.website_cdn.hosted_zone_id
    evaluate_target_health = true
  }
}
