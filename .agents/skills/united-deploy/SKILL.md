---
name: united-deploy
description: >-
  Procedures and runbook for deploying the UnitedWeb stack to AWS.
  Use this skill when the user asks to deploy the frontend, backend, or infrastructure,
  or asks about the deployment pipeline and steps.
---

# UnitedWeb Deployment Runbook

This skill outlines the steps to build and deploy the frontend, backend, and infrastructure to AWS.

## Prerequisites
- Valid AWS credentials in environment (`aws sts get-caller-identity`).
- Java 21 & Gradle installed.
- Node.js 20+ & npm installed.
- Terraform CLI installed.

---

## 1. Backend & Infrastructure Deployment

1. **Build Backend Fat JAR**:
   ```bash
   ./gradlew :core-service:shadowJar
   ```
   Ensures `core-service/build/libs/core-service-all.jar` is updated.

2. **Deploy via Terraform**:
   ```bash
   cd infrastructure
   terraform init
   terraform plan
   terraform apply
   ```
   Outputs:
   - `api_url`: API Gateway HTTP API endpoint.
   - `assets_bucket_name`: S3 media assets bucket.
   - `assets_cdn_url`: CloudFront URL for player photos and logos.

---

## 2. Frontend Deployment (Angular to S3 + CloudFront)

1. **Verify Environment Config**:
   Ensure `web/src/environments/environment.ts` contains the active `apiUrl` and `cdnUrl`:
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://601tz51c7e.execute-api.eu-central-1.amazonaws.com',
     cdnUrl: 'https://d1rm5h55nlqrob.cloudfront.net',
     unitedTeamName: 'United_Środa_Śląska',
   };
   ```

2. **Build Production Bundle**:
   ```bash
   cd web
   npm run build
   ```
   Artifacts are output to `web/dist/web/browser/`.

3. **Upload Static Assets to S3**:
   ```bash
   # Sync hashed JS/CSS chunks with long cache to /app/ folder in unified storage
   aws s3 sync dist/web/browser/ s3://<STORAGE_BUCKET>/app/ --delete

   # Ensure index.html is not aggressively cached
   aws s3 cp dist/web/browser/index.html s3://<STORAGE_BUCKET>/app/index.html \
     --cache-control "no-cache, no-store, must-revalidate"
   ```

4. **Invalidate CloudFront Cache**:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id <FRONTEND_DISTRIBUTION_ID> \
     --paths "/*"
   ```
