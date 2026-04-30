# Phase 2 — P2‑6 Manual Test Results

**Date:** 2026‑04‑28
**Branch:** `genspark_ai_developer`
**Scope:** Admin UI — Users, Roles, Account (frontend only). Backend
endpoints (P2‑3 / P2‑4 / P2‑5) are exercised end‑to‑end through the new
TanStack‑Query‑backed pages and feature‑folder API client.

> Re‑run this with `pnpm dev:api` + `pnpm dev:web` and the standard seed
> (`pnpm db:seed && pnpm db:seed:test-users`). The owner password from the
> seed is `Owner@12345`; the five test users (`manager`, `sales`,
> `accountant`, `purchasing`, `inventory`) all share `Test@12345`.

---

## 1. Quality gates

| Gate | Result |
| --- | --- |
| `pnpm -r lint` | ✅ shared 16 / api 40 / web **68** files, 0 fixes |
| `pnpm -r typecheck` | ✅ all 3 packages — `Done` |
| `pnpm -r test` | ✅ shared **69** + api **54** + web **49** = **172** tests |
| `pnpm -r build` | ✅ vite + nest builds, PWA precache 64 entries (1.94 MiB) |

> Web tests added in P2‑6: `PasswordStrengthMeter` (7) and
> `PermissionsEditor` (8). Net delta: +15 web tests from P2‑5.

## 2. Definition of Done — checklist

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Lint / typecheck / tests / build all pass | ✅ | §1 above |
| 2 | Users list (search + role filter + status filter + pagination 20/page) | ✅ | `01-users-list-desktop.png`, `02-users-list-mobile.png` |
| 3 | "Add user" creates user via POST /users with Idempotency‑Key (axios) | ✅ | curl §5; `03-create-user-modal.png` |
| 4 | Edit user PATCH /users/:id (no password fields, username read‑only) | ✅ | `UserEditForm.tsx`; pencil icon in row + detail page |
| 5 | Reset password POST /users/:id/reset‑password + strength meter | ✅ | `ResetPasswordForm.tsx`; key icon in row + detail page |
| 6 | Activate / Deactivate (revokes refresh tokens) | ✅ | curl §11–§13; `UsersListPage` row actions + detail page button |
| 7 | Delete user (soft delete, owner/self protected) — ConfirmDialog | ✅ | `UserDetailPage.tsx` |
| 8 | User detail: avatar/info, roles section, effective permissions | ✅ | `04-user-detail.png` (15 effective perms shown) |
| 9 | Roles grid (3‑col desktop, 1‑col mobile), shows perm + user counts | ✅ | `05-roles-grid.png` |
| 10 | Create role (lowercase key) + Permissions Editor | ✅ | `10-create-role-empty.png` |
| 11 | Edit role — name & key read‑only for system roles + warning banner | ✅ | `07-edit-system-role-warning.png` |
| 12 | Permissions Editor: 17 modules, search, group select‑all, sticky save | ✅ | `06-permissions-editor.png`; `PermissionsEditor.test.tsx` |
| 13 | Clone role flow ("Owner (نسخة)" pre‑filled, lowercase key required) | ✅ | curl §14 + `RoleFormPage.tsx` clone branch |
| 14 | Delete role hidden for system roles, ConfirmDialog otherwise | ✅ | curl §15 + `RolesListPage.tsx` |
| 15 | Account page: profile, change password, logout‑all | ✅ | `08-account-page.png`, `09-change-password-strength.png` |
| 16 | Routes guarded by `<ProtectedRoute>` + `<PermissionGate>` | ✅ | `apps/web/src/routes.tsx` |

## 3. Steps & Results — full transcript

Full curl transcript in `docs/phase2/curl/p2-6/01-admin-flow.txt`. Highlights:

```
─── 5. Create user with Idempotency-Key ───
HTTP/1.1 201 Created
X-Request-Id: 82b90f6f-…
Created: p2_6_test_1777347091 / موظف اختبار P2-6 | roles: ['SalesWorker']

─── 6. Replay same Idempotency-Key with DIFFERENT body → cached ───
HTTP/1.1 201 Created
Idempotent-Replay: true
Replayed body username: p2_6_test_1777347091    ← original body, NOT the new one

─── 7. Newly created user logs in successfully ───
Login result: ok | user: p2_6_test_1777347091 | permissions: 15

─── 9. Effective permissions of new user (sales) ───
Total: 15 | Sample: ['customer_transactions.create_debt',
                     'customer_transactions.create_payment',
                     'customer_transactions.print_receipt',
                     'customer_transactions.view',
                     'customers.create']

─── 10. Sales user (no users.view) tries GET /users → 403 ───
Status: 403 | Code: PERMISSION_DENIED | Missing: users.view

─── 12. Deactivated user cannot login ───
Error: 403 | Code: USER_INACTIVE

─── 14. Clone Owner role → cloned_p2_6_… ───
Cloned: cloned_p2_6_… / Owner (نسخة) | isSystem: False | permissions: 181

─── 15. Delete cloned role (non‑system, allowed) ───
{ "data": { "ok": true } }

─── 16. Try to delete system role (Owner) → expected error ───
{ "code": "SYSTEM_ROLE_UNDELETABLE", "statusCode": 403 }

─── 17. Logout-all (token revocation) ───
{ "ok": true, "revoked": 2 }
```

## 4. Role‑based UI permission sweep

Logged in as each test user and checked `/admin/users` access:

| Role | `/admin/users` (UI) | API GET /users |
| --- | --- | --- |
| Owner (`owner`) | ✅ visible, full CRUD | 200 (6 users) |
| Manager (`manager`) | ✅ visible, full CRUD | 200 |
| SalesWorker (`sales`) | ❌ `<ProtectedRoute>` denies → 403 page | 403 `PERMISSION_DENIED` (`users.view`) |
| Accountant (`accountant`) | ❌ denies | 403 |
| PurchasingOfficer (`purchasing`) | ❌ denies | 403 |
| InventoryOfficer (`inventory`) | ❌ denies | 403 |

> The frontend gate on `/admin/users` uses `permission="users.view"`. Because
> the access token is rotated after each login, permission changes persist
> across reloads (verified by toggling roles in the seed and re‑logging).

## 5. Screenshots

All under `docs/phase2/screenshots/p2-6/`:

| File | Caption |
| --- | --- |
| `01-users-list-desktop.png` | Users list, owner, RTL, 6 users, bottom counter "6 مستخدم" |
| `02-users-list-mobile.png` | Same page on iPhone 13 viewport (390×844) |
| `03-create-user-modal.png` | Add‑user modal — fullName / username / phone / passwords / roles multi‑select with نظامي badges |
| `04-user-detail.png` | InventoryOfficer detail with 15 effective permissions grouped by module |
| `05-roles-grid.png` | 6‑role grid (3‑col), each card shows نظامي badge + permission/user counts |
| `06-permissions-editor.png` | Manager role — 178/181 permissions, search bar, group counters, sticky save (لا توجد تغييرات) |
| `07-edit-system-role-warning.png` | Owner role — read‑only key field + amber "دور نظامي محمي" banner |
| `08-account-page.png` | /account profile + change‑password + logout‑all |
| `09-change-password-strength.png` | Change‑password section showing the 5‑segment gradient strength meter |
| `10-create-role-empty.png` | /admin/roles/new — clean editor (0/181 permissions, all groups) |

## 6. Self‑made decisions

1. **Role grid uses `permissionsCount` / `usersCount` (plural)** — the
   NestJS service returns these names; the original spec used the singular
   forms. Updated `RoleListItem` and `RolesListPage` to match the source of
   truth.
2. **`PaginatedUsers.meta.totalPages` is computed client‑side** — the API
   only returns `page / limit / total`, so `UsersListPage` derives
   `Math.ceil(total / limit)` for the pager.
3. **`RolesApi.list` accepts both shapes** — the backend returns
   `{ items: RoleListItem[] }` (paginated‑style envelope) but a future
   refactor might flatten it to an array; the wrapper handles either.
4. **Permissions editor groups by API order** — `PermissionsService` orders
   modules by first appearance in the `Permission` table; the UI preserves
   this and additionally hides empty groups via the search filter.
5. **System‑role guardrails are layered** — the frontend hides the delete
   button for `isSystem: true` roles AND surfaces the `SYSTEM_ROLE_UNDELETABLE`
   error toast if it ever slips through (e.g. via deep‑link).
6. **Account profile fields are read‑only by design** — per the spec, the
   "no editing here" notice is rendered next to the avatar; profile edits go
   through `/admin/users/:id` (owner only).
7. **`useResponsive(768px)` is shared** — `UserFormModal` and
   `ResetPasswordModal` automatically swap between `<Modal>` (desktop) and
   `<BottomSheet>` (mobile) via the same hook.

## 7. What is *not* in P2‑6 (deferred to P2‑7)

- Full E2E Playwright suite (we only ship a screenshot script).
- Visual regression baselines.
- README / docs/AUTH.md — placeholders only.
