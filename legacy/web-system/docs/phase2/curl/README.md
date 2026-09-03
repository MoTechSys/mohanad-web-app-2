# Phase 2 — cURL Test Outputs

Six end-to-end cURL tests run against `http://localhost:3001/api/v1` after seeding
(Owner `owner / Owner@12345` + Sales Worker `sales / Sales@12345`).

| # | File | Scenario | HTTP | Status |
|---|------|----------|------|--------|
| 1 | `01-login-success.txt` | Login as owner — returns access token + sets `grocery_refresh` httpOnly cookie | 200 | ✅ |
| 2 | `02-me-bearer.txt` | `GET /auth/me` with `Authorization: Bearer <accessToken>` returns user + 181 permissions | 200 | ✅ |
| 3 | `03-refresh-rotation.txt` | `POST /auth/refresh` rotates the token: old token revoked atomically (`revokedAt` set), new token issued, replay of old → 401 `REFRESH_INVALID` | 200 → 401 (replay) | ✅ |
| 4 | `04-unauthorized-401.txt` | Missing & malformed Bearer → 401 Unauthorized | 401 | ✅ |
| 5 | `05-forbidden-403.txt` | Sales Worker (no `users.view`/`users.create`/`roles.view`) → 403 `PERMISSION_DENIED` for `GET /users`, `POST /users`, `GET /roles`. Owner sanity-check returns 200 with paginated list | 403 (×3) + 200 | ✅ |
| 6 | `06-lockout-429.txt` | After 5 failed attempts → 429 `ACCOUNT_LOCKED` with `lockedUntil` ISO date and `retryAfterSec`. Even correct password is rejected while locked. DB confirms `failed_login_attempts=5`, `locked_until=...` | 401 (×5) → 429 → 429 | ✅ |

## How to reproduce

```bash
# 1. Start API
pnpm --filter @grocery/api start:dev

# 2. Seed (idempotent)
pnpm db:seed

# 3. Run the tests (requires bash, curl, psql, python3)
./tests/run-curl-tests.sh   # produces files in docs/phase2/curl/
```

## Key observations

* **Refresh rotation is atomic** — a Prisma `$transaction` revokes the old row (`updateMany ... revokedAt = now()`) before issuing a new one. Replay returns 401 `REFRESH_INVALID`.
* **Lockout returns ISO date** — frontend can render a countdown using `lockedUntil` and `retryAfterSec`.
* **Permission errors include the missing code** — the response `errors[].message` field carries the missing permission, so the UI can show *“missing: users.view”* in dev tools.
* **Owner has 181 permissions, Sales Worker has 15** — confirms RBAC sub-set semantics.
