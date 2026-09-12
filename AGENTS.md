# UnitedWeb Agent Guidelines & Project Manual

This repository contains the full-stack web platform for the **United Środa Śląska** volleyball team, competing in the Lower Silesian 2nd Volleyball League (II Liga Dolnośląska).

---

## 1. Project Architecture & Components

- **`web/`** (Frontend):
  - **Framework**: Angular 20+ (Standalone components, Angular Signals, SCSS, `@angular/build:application`).
  - **Styles**: Custom dark neon-green athletic design, CSS variables (`--color-accent-neon: #00e65b`), geometric Outfit font.
  - **Config**: Environment files in `src/environments/` (`environment.ts` for prod, `environment.development.ts` for dev).
  - **Assets**: Delivered via Amazon CloudFront CDN (Production: `https://d1rm5h55nlqrob.cloudfront.net`, Development: `https://dxrcawhjt411l.cloudfront.net`).

- **`core-service/`** (Backend REST API):
  - **Runtime**: Kotlin 2 / Java 21 on AWS Lambda (API Gateway V2 HTTP API payload format 2.0).
  - **Handler**: `com.united.handler.ApiLambdaHandler` implementing `RequestHandler<ApiRequest, ApiResponse>`.
  - **Local Development**: `com.united.LocalServerKt` runs a lightweight HTTP server on `http://localhost:8080` (zero extra dependencies).
  - **Endpoints**: `/standings`, `/results`, `/results/{teamName}`, `/fixtures`, `/fixtures/{teamName}`, `/roster`.

- **`common/`** (Shared Library):
  - Shared domain models (`MatchItem`, `PlayerItem`, `TeamStanding`, `PlayerPosition`).
  - `DynamoRepository`: Coroutines-based AWS SDK for Kotlin client managing `LeagueData-Prod` DynamoDB table.

- **`scraper-lambda/`** (Scraper Service):
  - AWS Lambda function `united-scraper-prod` running JSoup to scrape official DZPS volleyball league tables, matches, and results into DynamoDB (`LeagueData-Prod`). Triggered via EventBridge schedules.

- **`infrastructure/`** (IaC):
  - Terraform declarations for Lambda, API Gateway HTTP API, DynamoDB policies, S3 Assets bucket, and CloudFront CDN with Origin Access Control (OAC).

---

## 2. Command Reference

### Frontend (`web/`)
```bash
# Run local dev server (default port 4200, points to local API http://localhost:8080)
npm start

# Run unit tests (always use --watch=false in automated environments)
npm test -- --watch=false

# Build production bundle (outputs to web/dist/web/browser/)
npm run build
```

### Backend (`core-service/`)
```bash
# Run local API server on http://localhost:8080
./gradlew :core-service:run

# Compile classes
./gradlew :core-service:classes

# Run unit tests
./gradlew test

# Build deployment fat JAR (shadowJar)
./gradlew :core-service:shadowJar

# Seed roster to DynamoDB from test resources
./gradlew :core-service:seedRoster
```

### Infrastructure (`infrastructure/`)
```bash
cd infrastructure
terraform plan
terraform apply
```

---

## 3. Permissions & Guardrails

### Auto-Approved Operations (Safe)
- Running read-only / build / test commands: `npm test`, `npm run build`, `./gradlew test`, `./gradlew classes`, `./gradlew shadowJar`, `terraform plan`.
- Git inspections: `git status`, `git diff`, `git log`.
- Viewing and editing files within the workspace.

### Operations Requiring Explicit User Confirmation (Ask)
- Infrastructure mutations: `terraform apply`, `terraform destroy`.
- Destructive git commands: `git push`, `git reset --hard`, `git clean -fd`.
- File deletions affecting core database schemas or state files (`terraform.tfstate`).
- Direct mutations to AWS production resources (deleting S3 buckets, wiping DynamoDB tables).

### Strict Prohibitions (Deny)
- Never store secrets or AWS credentials in code, markdown, or git.
- Never make S3 buckets public (always use CloudFront Origin Access Control).
- Never commit `terraform.tfstate` or `.env` files.
