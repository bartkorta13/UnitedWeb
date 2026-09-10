# Workspace Permissions & Security Policy

## Allowed Actions
- **Compilation & Testing**:
  - `npm test -- --watch=false` in `web/`
  - `npm run build` in `web/`
  - `./gradlew test`
  - `./gradlew :core-service:classes`
  - `./gradlew :core-service:shadowJar`
- **Read-Only Commands**:
  - `git status`, `git diff`, `git log`
  - `terraform plan`
  - `curl http://localhost:8080/*`, `curl http://localhost:4200/*`

## Guarded Actions (Require User Confirmation)
- `terraform apply` or `terraform destroy`
- `aws s3 sync ... --delete`
- `git push` or `git checkout -b`
- Running background servers that bind external ports unless asked by the user

## Denied Actions
- Exposing AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) in source code or commits.
- Setting S3 buckets to public-read (`block_public_acls = false`).
- Committing `.env`, `*.tfstate`, or sensitive credentials.
