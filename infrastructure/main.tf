provider "aws" {
  region = "eu-central-1"
}

# 1. IAM Role: Allows Lambda to run and access DynamoDB
resource "aws_iam_role" "lambda_exec" {
  name = "united_api_lambda_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

# Attach basic execution logs to the Lambda
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Attach DynamoDB Read permissions (adjust table name if needed)
resource "aws_iam_role_policy" "dynamodb_read" {
  name = "dynamodb_read_access"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:Query", "dynamodb:Scan", "dynamodb:GetItem"]
      Resource = "*"
    }]
  })
}

# 2. The Lambda Function
resource "aws_lambda_function" "api_lambda" {
  function_name = "united-core-api"
  role          = aws_iam_role.lambda_exec.arn

  # Points to the fat JAR
  filename         = "../core-service/build/libs/core-service-all.jar"
  source_code_hash = filebase64sha256("../core-service/build/libs/core-service-all.jar")

  handler = "com.united.handler.ApiLambdaHandler::handleRequest"
  runtime = "java21"
  timeout = 15
  memory_size = 512
}

# 3. API Gateway
resource "aws_apigatewayv2_api" "http_api" {
  name          = "united-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["content-type"]
  }
}

# 4. API Gateway Integration & Explicit Routes
resource "aws_apigatewayv2_integration" "lambda_proxy" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_lambda.invoke_arn
  payload_format_version = "2.0" # <-- THIS IS THE FIX
}

resource "aws_apigatewayv2_route" "get_results_by_path" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /results/{teamName}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "get_results_by_query" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /results" # Maps to /results?teamName=Team_X
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

# Fixtures by path parameter (e.g., /fixtures/Team_X)
resource "aws_apigatewayv2_route" "get_fixtures_by_path" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /fixtures/{teamName}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

# Fixtures by query parameter (e.g., /fixtures?teamName=Team_X)
resource "aws_apigatewayv2_route" "get_fixtures_by_query" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /fixtures"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "get_standings" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /standings"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

# 5. API Gateway Stage
resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# 6. Permissions for API Gateway to invoke Lambda
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 7. Output URL
output "api_url" {
  description = "Base URL for your API Gateway stage."
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

# ------------------------------------------------------------------------------
# 8. S3 Bucket for Media Assets (Private storage)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "assets" {
  bucket_prefix = "united-league-assets-"
  force_destroy = true

  tags = {
    Project     = "UnitedWeb"
    Environment = "production"
  }
}

# Block all direct public access (CloudFront will access via OAC)
resource "aws_s3_bucket_public_access_block" "assets_access" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ------------------------------------------------------------------------------
# 9. CloudFront Origin Access Control (OAC)
# ------------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "assets_oac" {
  name                              = "united-assets-oac"
  description                       = "Origin Access Control for United Assets S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Fetch AWS Managed Cache Policy for optimized asset delivery
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# ------------------------------------------------------------------------------
# 10. CloudFront Distribution (Global CDN)
# ------------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "assets_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront CDN for United Assets"
  price_class         = "PriceClass_100" # Europe, USA, Canada

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.assets.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets_oac.id
  }

  default_cache_behavior {
    target_origin_id       = "S3-${aws_s3_bucket.assets.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Project     = "UnitedWeb"
    Environment = "production"
  }
}

# ------------------------------------------------------------------------------
# 11. S3 Bucket Policy: Only CloudFront can read files
# ------------------------------------------------------------------------------
resource "aws_s3_bucket_policy" "assets_oac_policy" {
  bucket = aws_s3_bucket.assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.assets_cdn.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 12. Asset Outputs
# ------------------------------------------------------------------------------
output "assets_bucket_name" {
  description = "S3 bucket name to upload assets/logos to via AWS CLI or Console"
  value       = aws_s3_bucket.assets.id
}

output "assets_cdn_url" {
  description = "CloudFront CDN Base URL for your frontend"
  value       = "https://${aws_cloudfront_distribution.assets_cdn.domain_name}"
}