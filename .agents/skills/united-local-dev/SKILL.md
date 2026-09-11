---
name: united-local-dev
description: >-
  Procedures for running and debugging the full UnitedWeb stack locally.
  Use this skill when the user asks to start local development, run the API on localhost:8080,
  or start the Angular dev server on localhost:4200.
---

# UnitedWeb Local Development Runbook

This skill guides running both the backend API and frontend Angular app locally.

## Port Map
- **Frontend App**: `http://localhost:4200` (Angular Dev Server)
- **Backend API**: `http://localhost:8080` (Kotlin `LocalServer`)
- **DynamoDB Local**: `http://localhost:8000` (In-memory DynamoDB)

---

## 1. Local Database (`DynamoDB Local`)

Local development never connects to AWS DynamoDB production.
You can run DynamoDB Local in any of these ways:
- **Automatic (zero-config)**: Simply run `./gradlew :core-service:run`. `LocalServer` detects if port 8000 is open; if not, it automatically spawns an embedded DynamoDB Local process and auto-seeds roster, standings, and news!
- **Docker**: `docker compose up -d` (uses official `amazon/dynamodb-local:latest`).
- **Standalone Gradle**: `./gradlew :core-service:startDynamoDbLocal`.

### Run Scraper Locally (Populate DynamoDB Local with Live DZPS Data):
Aby pobrać aktualną tabelę i terminarz z oficjalnego serwisu DZPS i zapisać je w lokalnej bazie DynamoDB:
```bash
./gradlew :scraper-lambda:run
```
(lub uruchom `fun main()` w `scraper-lambda/src/main/kotlin/com/united/LocalScraper.kt`).
Scraper automatycznie wykrywa `http://localhost:8000` i nie łączy się z produkcją AWS.

---

## 2. Start Backend API (`core-service`)

In the root of the project:
```bash
./gradlew :core-service:run
```
Or run `fun main()` in `core-service/src/main/kotlin/com/united/LocalServer.kt` from IntelliJ IDEA.

### Available Local Endpoints:
- `http://localhost:8080/standings` - League standings with computed form
- `http://localhost:8080/results` - All matches played
- `http://localhost:8080/results/United_%C5%9Aroda_%C5%9Al%C4%85ska` - United results
- `http://localhost:8080/fixtures` - Upcoming fixtures
- `http://localhost:8080/fixtures/United_%C5%9Aroda_%C5%9Al%C4%85ska` - United fixtures
- `http://localhost:8080/roster` - Team players & coach

---

## 2. Start Frontend App (`web`)

In the `web/` directory:
```bash
npm start
```
Or to automatically open the browser:
```bash
npm start -- --open
```

Angular runs using `environment.development.ts`, connecting to `http://localhost:8080`.

---

## 3. Verification & Troubleshooting

- **Check active ports**:
  ```bash
  lsof -i :8080 -i :4200
  ```
- **Test API response**:
  ```bash
  curl -s http://localhost:8080/standings | head -c 200
  ```
- **Port Conflict**: If port 8080 or 4200 is busy, terminate the previous process:
  ```bash
  kill $(lsof -t -i :8080)
  kill $(lsof -t -i :4200)
  ```
