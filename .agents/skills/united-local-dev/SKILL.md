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
- **Backend API**: `http://localhost:8080` (Kotlin `LocalServer`)
- **Frontend App**: `http://localhost:4200` (Angular Dev Server)

---

## 1. Start Backend API (`core-service`)

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
