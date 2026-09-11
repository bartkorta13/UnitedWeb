provider "aws" {
  region = "eu-central-1"
}

# 0. DynamoDB Table: Production League Data (Protected & Point-in-Time Recovery)
resource "aws_dynamodb_table" "league_data" {
  name           = "LeagueData"
  billing_mode   = "PROVISIONED"
  read_capacity  = 1
  write_capacity = 1
  hash_key       = "PK"
  range_key      = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  tags = {
    Project     = "UnitedWeb"
    Environment = "production"
  }
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

# Attach DynamoDB Read & Write permissions (Restricted to LeagueData table only)
resource "aws_iam_role_policy" "dynamodb_access" {
  name = "dynamodb_access"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem"
      ]
      Resource = [
        aws_dynamodb_table.league_data.arn,
        "${aws_dynamodb_table.league_data.arn}/index/*"
      ]
    }]
  })
}

# Attach S3 PutObject permission for generating pre-signed upload URLs
resource "aws_iam_role_policy" "s3_upload_policy" {
  name = "s3_upload_access"
  role = aws_iam_role.lambda_exec.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = [
        "${aws_s3_bucket.assets.arn}/*",
        "${aws_s3_bucket.dev_assets.arn}/*"
      ]
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

  environment {
    variables = {
      ASSETS_S3_BUCKET = aws_s3_bucket.assets.id
      ASSETS_CDN_URL   = "https://${aws_cloudfront_distribution.assets_cdn.domain_name}"
    }
  }
}

# 3. API Gateway
resource "aws_apigatewayv2_api" "http_api" {
  name          = "united-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
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

resource "aws_apigatewayv2_route" "get_roster" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /roster"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "get_news" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /news"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

resource "aws_apigatewayv2_route" "get_news_by_id" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /news/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
}

# ------------------------------------------------------------------------------
# 4a. Cognito User Pool: Authentication for Admin Panel
# ------------------------------------------------------------------------------
resource "aws_cognito_user_pool" "admin_pool" {
  name = "united-admin-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  tags = {
    Project     = "UnitedWeb"
    Environment = "production"
  }
}

resource "aws_cognito_user_pool_client" "admin_client" {
  name         = "united-admin-client"
  user_pool_id = aws_cognito_user_pool.admin_pool.id

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
}

# ------------------------------------------------------------------------------
# 4b. API Gateway JWT Authorizer for Cognito
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "united-cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.admin_client.id]
    issuer   = "https://${aws_cognito_user_pool.admin_pool.endpoint}"
  }
}

# ------------------------------------------------------------------------------
# 4c. Protected Admin Routes (Requires Cognito JWT)
# ------------------------------------------------------------------------------
resource "aws_apigatewayv2_route" "get_admin_news" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /admin/news"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_admin_news" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /admin/news"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "put_admin_news" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "PUT /admin/news/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_admin_news" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /admin/news/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_upload_url" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /admin/news/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.lambda_proxy.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
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

# Allow direct browser uploads via S3 Pre-signed PUT URLs (Local dev + Production UI)
resource "aws_s3_bucket_cors_configuration" "assets_cors" {
  bucket = aws_s3_bucket.assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = [
      "http://localhost:4200",
      "https://${aws_cloudfront_distribution.frontend_cdn.domain_name}"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
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
# 10. CloudFront Distribution: Media Assets (Global CDN with /assets path)
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
    origin_path              = "/assets"
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
# 11. CloudFront Distribution: Frontend UI (Global CDN with /app path & SPA Fallback)
# ------------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "frontend_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront CDN for United Frontend UI"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # Europe, USA, Canada

  origin {
    domain_name              = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.assets.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets_oac.id
    origin_path              = "/app"
  }

  default_cache_behavior {
    target_origin_id       = "S3-${aws_s3_bucket.assets.id}"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  # SPA Routing Fix: 403 & 404 redirected to /index.html with HTTP 200
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
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
# 12. S3 Bucket Policy: Allows both CloudFront distributions to read files via OAC
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
            "AWS:SourceArn" = [
              aws_cloudfront_distribution.assets_cdn.arn,
              aws_cloudfront_distribution.frontend_cdn.arn
            ]
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 12b. Dev Assets S3 Bucket & CloudFront CDN (Option A: Dedicated Development S3)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "dev_assets" {
  bucket_prefix = "united-league-assets-dev-"
  force_destroy = true

  tags = {
    Project     = "UnitedWeb"
    Environment = "development"
  }
}

# Block all direct public access
resource "aws_s3_bucket_public_access_block" "dev_assets_access" {
  bucket = aws_s3_bucket.dev_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Allow direct browser uploads from local dev (http://localhost:4200)
resource "aws_s3_bucket_cors_configuration" "dev_assets_cors" {
  bucket = aws_s3_bucket.dev_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = [
      "http://localhost:4200",
      "http://localhost:8080"
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_cloudfront_distribution" "dev_assets_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront CDN for United Dev Assets"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.dev_assets.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.dev_assets.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.assets_oac.id
    origin_path              = "/assets"
  }

  default_cache_behavior {
    target_origin_id       = "S3-${aws_s3_bucket.dev_assets.id}"
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
    Environment = "development"
  }
}

resource "aws_s3_bucket_policy" "dev_assets_oac_policy" {
  bucket = aws_s3_bucket.dev_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontDevReadOnly"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.dev_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.dev_assets_cdn.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# 13. Outputs
# ------------------------------------------------------------------------------
output "storage_bucket_name" {
  description = "Single S3 bucket for both /app and /assets"
  value       = aws_s3_bucket.assets.id
}

output "assets_bucket_name" {
  description = "Single S3 bucket name (alias for backwards compatibility)"
  value       = aws_s3_bucket.assets.id
}

output "frontend_cdn_url" {
  description = "Public HTTPS URL for the UnitedWeb Frontend application"
  value       = "https://${aws_cloudfront_distribution.frontend_cdn.domain_name}"
}

output "assets_cdn_url" {
  description = "CloudFront CDN Base URL for media assets (photos & logos)"
  value       = "https://${aws_cloudfront_distribution.assets_cdn.domain_name}"
}

output "dev_assets_bucket_name" {
  description = "Dedicated S3 bucket for development/testing assets"
  value       = aws_s3_bucket.dev_assets.id
}

output "dev_assets_cdn_url" {
  description = "CloudFront CDN Base URL for development media assets"
  value       = "https://${aws_cloudfront_distribution.dev_assets_cdn.domain_name}"
}

output "dynamodb_table_arn" {
  description = "ARN of the production LeagueData DynamoDB table"
  value       = aws_dynamodb_table.league_data.arn
}

output "frontend_distribution_id" {
  description = "CloudFront Distribution ID for running frontend cache invalidations"
  value       = aws_cloudfront_distribution.frontend_cdn.id
}

output "assets_distribution_id" {
  description = "CloudFront Distribution ID for running assets cache invalidations"
  value       = aws_cloudfront_distribution.assets_cdn.id
}

output "cognito_user_pool_id" {
  description = "ID of the Cognito User Pool for admin authentication"
  value       = aws_cognito_user_pool.admin_pool.id
}

output "cognito_client_id" {
  description = "Client ID of the Cognito User Pool Client for web frontend"
  value       = aws_cognito_user_pool_client.admin_client.id
}