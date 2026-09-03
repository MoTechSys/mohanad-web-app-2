# Phase 2 P2-5 — Manual Test Results

> Date: 2026-04-28 · Branch: `genspark_recovery` · API: `localhost:3001` · Web: `localhost:5173`

## 1. Idempotency Middleware (DB-cached replay)

**Setup**
- API up; logged in as `owner` (181 perms); used `cmohy8q5i00f5kb5ra5zcwx1f` SalesWorker role.
- Generated `Idempotency-Key=95f7a476-a884-452f-ab31-74f9873e69a0`.

**Steps & Results** (full transcripts: `docs/phase2/curl/p2-5/01-idempotency.txt`, `docs/phase2/curl/p2-5/03-idempotency-with-create.txt`)

| # | Action                                                              | Expected                                                                  | Result | Notes                                                                                                                |
|---|---------------------------------------------------------------------|---------------------------------------------------------------------------|:------:|----------------------------------------------------------------------------------------------------------------------|
| 1 | `POST /users` with new key, payload A                               | 201, no `Idempotent-Replay` header                                         |   ✅   | User `idem_5931` created (id `cmoi10al200118ug8yqfy4pjq`).                                                            |
| 2 | DB row in `idempotency_keys`                                        | 1 row, status_code=201, ttl≈24:00:00                                       |   ✅   | endpoint=`POST /api/v1/users`, resp_size=564 bytes, ttl=`23:59:59.999`.                                              |
| 3 | `POST /users` with **same** key, payload B (different username)     | 201 + `Idempotent-Replay: true` + cached response (NOT payload B)          |   ✅   | Returned the original user `idem_5931`, header `Idempotent-Replay: true` present.                                    |
| 4 | DB after replay                                                     | Only ONE user actually created (no `DIFFERENT_idem_5931`)                  |   ✅   | DB has `idem_5931` only; `DIFFERENT_*` never appeared.                                                               |
| 5 | `GET /users` with the same key                                      | Bypasses middleware (safe verbs)                                           |   ✅   | Status 200, no `Idempotent-Replay` header.                                                                            |

**Conclusion**: middleware (a) intercepts unsafe methods only, (b) caches successful 2xx responses for 24 h, (c) replays cached body verbatim, (d) leaves safe verbs untouched.

---

## 2. End-to-End Auth Flow (Browser)

Captured via Playwright (Chromium 1217, locale `ar-SA`).  Screenshots: `docs/phase2/screenshots/`.

### 2.1 Login UI (mobile + desktop)
- `01-login-mobile.png` (412×915): Glass card, RTL Arabic, RHF-bound inputs, remember-me, Helmet+CORS footer.
- `05-login-desktop.png` (1440×900): Identical visual on desktop viewport.

### 2.2 Lockout Countdown
- Triggered 5 wrong-password POSTs against `manager` via API.
- 6th attempt from the browser surfaces `data-testid="lockout-banner"` instantly (no extra round trip).
- `02-lockout-countdown.png`: banner reads "تم قفل الحساب مؤقتاً" with **14:57** running countdown (from initial 15:00). Submit button disabled and labelled `قفل مؤقت — 14:57`.
- API response inspected in script log:
  ```json
  {"statusCode":429,"message":"تم قفل الحساب مؤقتاً بسبب محاولات فاشلة متكررة","code":"ACCOUNT_LOCKED","lockedUntil":"2026-04-28T03:05:05.428Z","retryAfterSec":900}
  ```

### 2.3 Successful Login + Welcome Toast
- `03-dashboard-welcome-mobile.png`: logged in as `sales` (`Test@12345`), redirected to `/dashboard`, top toast shows **"مرحباً بائع!"** (`بائع` is the Sales Worker's `fullName`).

### 2.4 BottomNav Adapts to Role
- `04-bottomnav-salesworker.png`: Sales Worker sees **4 tabs** = `المزيد · العملاء · المبيعات · الرئيسية`.  Hidden tabs (TC verified): `المصاريف`, `التقارير`, `المخزون`, `المشتريات`, `الموردون`.
- Unit tests confirm catalog filtering for Owner (≤5 with overflow `المزيد`), Accountant (`المصاريف` + `التقارير`), and unauthenticated (only `الرئيسية`).

### 2.5 Auto-Refresh on 401
- Tested via the axios `refreshOnce()` helper: tampering with the in-memory token then issuing any request triggers exactly one `POST /auth/refresh` (cookie-driven), updates the in-memory token, and replays the original request.
- Concurrent 401s are coalesced into a single refresh promise — verified through code review (`http.ts ► refreshInFlight`).

---

## 3. Role-Based UI Permission Sweep

For each test user (`pnpm db:seed:test-users` provisions all five), checked:

| User         | Role               | BottomNav (visible)                                            | `/dashboard` access | API `/users` |
|--------------|--------------------|----------------------------------------------------------------|:-------------------:|:------------:|
| `owner`      | Owner              | الرئيسية · المبيعات · العملاء · المصاريف · المزيد (5 cap, overflow) |         ✅          |     200      |
| `manager`    | Manager            | الرئيسية · المبيعات · العملاء · المصاريف · المزيد              |         ✅          |     200      |
| `sales`      | SalesWorker        | الرئيسية · المبيعات · العملاء · المزيد                          |         ✅          |     **403**  |
| `accountant` | Accountant         | الرئيسية · المصاريف · التقارير                                 |         ✅          |     **403**  |
| `purchasing` | PurchasingOfficer  | الرئيسية · المشتريات · الموردون · المخزون                       |         ✅          |     **403**  |
| `inventory`  | InventoryOfficer   | الرئيسية · المخزون · المنتجات                                  |         ✅          |     **403**  |

403 responses include the missing permission code in `errors[].message` (e.g. `users.view`).

---

## 4. Definition-of-Done Checklist

| # | DoD item                                              | Status | Evidence                                                                  |
|---|-------------------------------------------------------|:------:|---------------------------------------------------------------------------|
| 1 | lint / typecheck / tests / build all pass             |   ✅   | shared 69, api 54, web 34 = **157 tests**; build emits `dist/` cleanly.    |
| 2 | Real login end-to-end                                 |   ✅   | `03-dashboard-welcome-mobile.png` + cURL transcripts.                      |
| 3 | `/dashboard` redirects to `/login` when unauthenticated|   ✅   | `ProtectedRoute` + `bootstrap()` (skeleton during refresh probe).         |
| 4 | Auto-refresh on 401                                   |   ✅   | `http.ts ► refreshOnce()` + integration via `useAuthStore.refresh()`.     |
| 5 | Visible lockout countdown                             |   ✅   | `02-lockout-countdown.png` (14:57) + `useLockoutCountdown` unit tests.    |
| 6 | Arabic welcome toast                                  |   ✅   | `LoginPage` calls `toast.success("مرحباً ${user.fullName}!")`.            |
| 7 | BottomNav adapts per role (≥3 users)                  |   ✅   | Owner / Manager / SalesWorker / Accountant / Purchasing / Inventory.       |
| 8 | PermissionGate works                                  |   ✅   | 7 unit tests (`permission` / `allOf` / `anyOf` / fallback / unauth).       |
| 9 | Idempotency middleware stores/retrieves DB entries    |   ✅   | `docs/phase2/curl/p2-5/03-idempotency-with-create.txt` (DB inspect before/after, replay header verified). |
| 10| Seed script idempotent                                |   ✅   | `pnpm db:seed:test-users` re-runnable; uses Prisma `upsert`.              |
