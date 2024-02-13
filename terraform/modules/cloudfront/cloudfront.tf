resource "aws_s3_bucket" "bucket" {
  bucket = "${var.environment}-${var.name}"

  tags = {
    Name = "${var.environment}-${var.name}"
  }
}

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for S3 access"
}

resource "aws_s3_bucket_policy" "allow_cloudfront" {
  bucket = aws_s3_bucket.bucket.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Principal = {
          AWS = "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${aws_cloudfront_origin_access_identity.oai.id}"
        },
        Action   = "s3:GetObject",
        Resource = "${aws_s3_bucket.bucket.arn}/*",
      },
    ],
  })
}

locals {
  s3_origin_id = "gpsS3Origin"
}

resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name = aws_s3_bucket.bucket.bucket_regional_domain_name
    origin_id   = local.s3_origin_id
    s3_origin_config {
      origin_access_identity = "origin-access-identity/cloudfront/${aws_cloudfront_origin_access_identity.oai.id}"
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Frontend for Galleri Invitations"
  default_root_object = "1.0.0/_next/server/app/index.html"

  # logging_config {
  #   include_cookies = false
  #   bucket          = "${var.environment}-${var.name}.s3.amazonaws.com"
  #   prefix          = "${var.environment}-${var.name}"
  # }

  # aliases = ["cicd-gps-cancer-detection-blood-test.nhs.uk"]

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "allow-all"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Cache behavior with precedence 0
  ordered_cache_behavior {
    path_pattern     = "/content/immutable/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false
      headers      = ["Origin"]

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # Cache behavior with precedence 1
  ordered_cache_behavior {
    path_pattern     = "/content/*"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.s3_origin_id

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  price_class = "PriceClass_200"

  restrictions {
    geo_restriction {
      restriction_type = "whitelist"
      locations        = ["GB"]
    }
  }

  tags = {
    Environment = var.environment
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

























# # Pass in the s3 bucket as a var

# resource "aws_s3_bucket" "bucket" {
#   bucket = "${var.environment}-${var.name}"

#   website {
#     index_document = "index.html"
#     error_document = "error.html"
#   }
# }


# # Need to tighten up permissions
# resource "aws_s3_bucket_policy" "website_bucket_policy" {
#   bucket = aws_s3_bucket.bucket.id

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Action    = ["s3:GetObject"]
#         Effect    = "Allow"
#         Resource  = "${aws_s3_bucket.bucket.arn}/*"
#         Principal = "*"
#       },
#     ]
#   })
# }


# resource "aws_cloudfront_origin_access_identity" "oai" {
#   comment = "OAI for ${aws_s3_bucket.bucket.bucket}"
# }


# resource "aws_s3_bucket_policy" "bucket_policy" {
#   bucket = aws_s3_bucket.bucket.id

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Action    = "s3:GetObject"
#         Effect    = "Allow"
#         Resource  = "${aws_s3_bucket.bucket.arn}/*"
#         Principal = { AWS = "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity ${aws_cloudfront_origin_access_identity.oai.id}" }
#       },
#     ]
#   })
# }

# resource "aws_cloudfront_distribution" "website_cdn" {
#   origin {
#     domain_name = aws_s3_bucket.bucket.website_endpoint
#     origin_id   = aws_s3_bucket.bucket.id

#     s3_origin_config {
#       origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
#     }
#   }

#   enabled             = true
#   is_ipv6_enabled     = true
#   default_root_object = "1.0.0/server/app/index.html"

#   aliases = ["yourdomain.com", "www.yourdomain.com"]

#   default_cache_behavior {
#     allowed_methods  = ["GET", "HEAD"]
#     cached_methods   = ["GET", "HEAD"]
#     target_origin_id = aws_s3_bucket.bucket.id

#     forwarded_values {
#       query_string = false
#       cookies {
#         forward = "none"
#       }
#     }

#     viewer_protocol_policy = "redirect-to-https"
#     min_ttl                = 0
#     default_ttl            = 3600
#     max_ttl                = 86400
#   }

#   viewer_certificate {
#     acm_certificate_arn = "arn:aws:acm:eu-west-2:${var.account_id}:certificate/certificate-id"
#     ssl_support_method  = "sni-only"
#   }

#   restrictions {
#     geo_restriction {
#       restriction_type = "none"
#     }
#   }
# }

# # If your domain is managed by AWS Route 53, you can also automate the DNS configuration
# resource "aws_route53_record" "www" {
#   zone_id = "Z09488402R4XRNI40X8CO"
#   name    = "${var.dns_zone}-gps-cancer-detection-blood-test.nhs.uk"
#   type    = "A"

#   alias {
#     name                   = aws_cloudfront_distribution.website_cdn.domain_name
#     zone_id                = aws_cloudfront_distribution.website_cdn.hosted_zone_id
#     evaluate_target_health = true
#   }
# }
