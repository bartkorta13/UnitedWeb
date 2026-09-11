---
name: united-roster-management
description: >-
  Procedures for managing the United Środa Śląska volleyball roster.
  Use this skill when adding or editing players/coach, updating stats or captaincy,
  handling photos in S3/CloudFront, or seeding DynamoDB.
---

# UnitedWeb Roster Management Runbook

This skill describes how to update players, upload photos, and sync roster data with DynamoDB.

## 1. Roster Data Source
The initial roster is stored as a JSON resource in `core-service/src/test/resources/roster.json`.

Fields for each player:
- `id`: Slug format, e.g. `"bartosz-korta"` (matches photo filename `bartosz-korta.png`)
- `firstName`: e.g. `"Bartosz"`
- `lastName`: e.g. `"Korta"`
- `position`: `"OUTSIDE"` (Przyjmujący), `"OPPOSITE"` (Atakujący), `"MIDDLE"` (Środkowy), `"SETTER"` (Rozgrywający), `"LIBERO"` (Libero), `"COACH"` (Trener)
- `number`: Player jersey number (omitted or 0 for Coach)
- `height`: in cm (e.g. `193`)
- `attackRange`: in cm (e.g. `345`)
- `age`: in years (e.g. `27`)
- `isCaptain`: `true` or `false`

## 2. Seed Roster to DynamoDB
Run the custom Gradle task:
```bash
./gradlew :core-service:seedRoster
```
This executes `SeedRosterTest` which reads `roster.json` and puts items into the `LeagueData` table with:
- `PK`: `"ROSTER"`
- `SK`: `"PLAYER#<id>"`

## 3. Player Photos & Media CDN
- Bucket prefix: `united-league-assets-...`
- CloudFront domain: `https://d1rm5h55nlqrob.cloudfront.net`
- Photo path convention: `roster/<id>.png` (e.g. `roster/bartosz-korta.png`)

Upload a photo using AWS CLI (into /assets/roster/ folder):
```bash
aws s3 cp my-photo.png s3://<STORAGE_BUCKET_NAME>/assets/roster/<id>.png --content-type image/png
```
If a photo is missing or fails to load, the frontend automatically falls back to an athletic silhouette avatar with player number in background watermark.
