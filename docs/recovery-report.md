# Foundation Recovery Report

> Branch `genspark_recovery` — completed 2026‑04‑28
> Scope: undo Foundation deviations (A1), rebuild backend (A2) and frontend (A3) per spec, add tests (A4), finalise root files (A5).

---

## 1. Executive summary

The previous Foundation commit (`1bbdff8 — feat(foundation): initialize monorepo`) shipped a working scaffold but deviated from `docs/` decisions in several places: a 27-model Prisma schema, ESLint+Prettier instead of Biome, `/health` instead of `/api/v1/health`, no global filters/interceptors, no design system, and a placeholder UI page only. This recovery PR restores full alignment with `docs/12-agent-memory.md` and the recovery decisions Q1–Q9 (now permanent record in section 15 of that file).

All Definition‑of‑Done checks pass:

- ✅ `pnpm lint`        → 91 files, 0 errors (Biome)
- ✅ `pnpm typecheck`   → packages/shared + apps/api + apps/web → all Done
- ✅ `pnpm test`        → **70 tests pass** (69 shared + 1 api), 100% statements / 98.14% branches on covered surface
- ✅ `pnpm build`       → API + web + shared all green; PWA artefacts (`sw.js`, `manifest.webmanifest`, `offline.html`, 9 icons) emitted
- ✅ Lighthouse (preview build, headless Chromium): **Performance 81 / Accessibility 92 / Best-Practices 96 / SEO 91**; LCP 4.1 s, TBT 0 ms, CLS 0; report at `apps/web/lighthouse-report.json`

---

## 2. Before / After deviation table

| #   | Area              | Before (1bbdff8)                                  | After (genspark_recovery)                                                                          |
| --- | ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | **Schema models** | 27 models including all financial + reporting    | **8 models** (Store, User, Role, Permission, RolePermission, UserRole, Setting, AuditLog) — Q1     |
| 2   | **Schema location** | `apps/api/prisma/schema.prisma`                  | **Root** `prisma/schema.prisma` — Q5                                                               |
| 3   | **Legacy schema** | n/a                                               | Archived in `docs/legacy/foundation-schema-archive.prisma` with header — Q1                        |
| 4   | **Migrations**    | One init migration committed                      | Migrations folder removed; `prisma/migrations/` git-ignored — Q2                                   |
| 5   | **Lint stack**    | ESLint 9 + Prettier 3 + tailwind plugin           | **Biome 1.9.4** at root (replaces both) — Q5                                                       |
| 6   | **Pre-commit**    | Husky exists, hook empty                          | `.husky/pre-commit` runs `pnpm lint-staged` with Biome                                             |
| 7   | **API prefix**    | `/health` (no version prefix)                     | **`/api/v1/*`** with explicit `excludePaths` for docs/health                                       |
| 8   | **API docs**      | Swagger UI at `/docs`                             | **Scalar** API reference at `/api/v1/docs` + JSON at `/api/v1/docs-json`                           |
| 9   | **Filters**       | None                                              | Global `AllExceptionsFilter` (handles ZodError, HttpException, generic Error, Arabic messages)      |
| 10  | **Interceptors**  | None                                              | Global `ResponseFormatInterceptor` (envelope: `{ data, meta }` for success, `{ error }` for fail) |
| 11  | **Pipes**         | None                                              | Reusable `ZodValidationPipe` ready for Phase 2 DTOs                                                |
| 12  | **Middleware**    | None                                              | `RequestIdMiddleware` (generates / propagates `X-Request-Id`)                                      |
| 13  | **Modules**       | App + Health only                                 | + auth, users, roles, permissions placeholder modules — all return **501** with Arabic message    |
| 14  | **Graceful shutdown** | Default Nest behavior                         | `app.enableShutdownHooks()` + Prisma `onModuleDestroy()` disconnect                                |
| 15  | **PrismaService** | n/a                                               | Wraps PrismaClient with structured logging + `pingDb()` for health endpoint                        |
| 16  | **Health response** | `{ status: 'ok' }`                              | `{ status, uptimeSeconds, timestamp, version, database }` wrapped in unified envelope              |
| 17  | **Config validation** | None                                          | Zod env schema (`config-validation.schema.ts`) with defaults + min-length checks for JWT secrets  |
| 18  | **Web home page** | `<FoundationPage>` placeholder                   | LoginPage + DashboardPage + NotFoundPage; routes wired through React‑Router v5 (Q4)               |
| 19  | **UI components** | None                                              | **13 UI components**: Button, Input, Card, Badge, Avatar, Modal, BottomSheet, Toast, Skeleton, EmptyState, ConfirmDialog, DataTable, PageTransition |
| 20  | **Layout components** | None                                          | **5 layout components**: AppShell, Sidebar, BottomNav, MobileTopBar, PageHeader                    |
| 21  | **Dashboard widgets** | None                                          | StatCard (3D tilt + sparkline), QuickActionCard, Sparkline (SVG)                                   |
| 22  | **Design tokens** | n/a                                               | `src/design/tokens.ts` mirrors Tailwind config (Emerald palette, motion curves, shadows)           |
| 23  | **Fonts**         | `@import` Google Fonts CSS                        | **Self-hosted** woff2 in `apps/web/public/fonts/` — IBM Plex Sans Arabic 400/500/600/700 + JetBrains Mono 400; only regular weight preloaded; `font-display: swap` — Q6 |
| 24  | **404 page**      | n/a (or planned Lottie)                           | SVG animated via framer‑motion variants — Q7                                                        |
| 25  | **i18n**          | n/a                                               | `src/i18n/ar.ts` central Arabic strings dictionary                                                  |
| 26  | **HTTP client**   | n/a                                               | Axios singleton (`lib/http.ts`) with `withCredentials`, dev proxy, ready for Phase 2 interceptors  |
| 27  | **Query client**  | Created inline                                    | Centralised `lib/queryClient.ts`; `QueryClientProvider` in `main.tsx`                              |
| 28  | **Auth store**    | n/a                                               | Zustand `stores/authStore.ts` skeleton (state shape ready for Phase 2)                             |
| 29  | **Permission gate** | n/a                                             | `<PermissionGate>` component using `hasAnyPermission` / `hasAllPermissions` from shared             |
| 30  | **PWA**           | Disabled (`VITE_ENABLE_SW`)                       | `vite-plugin-pwa` enabled; static-asset precache; `/api/*` excluded with `NetworkOnly` — Q8        |
| 31  | **PWA icons**     | None                                              | 8 SVG icon sizes + maskable + favicon                                                              |
| 32  | **Splash screen** | None                                              | Inline CSS splash in `index.html`; hidden by `main.tsx` after React mounts                          |
| 33  | **Tests**         | None                                              | **70 tests**: utils (22), schemas/common (23), schemas/auth (8), permissions/roles + describePermission (16), health controller (1) — 100% statements on covered surface |
| 34  | **Vitest config** | n/a in shared                                     | `packages/shared/vitest.config.ts` (Node env, v8 coverage)                                          |
| 35  | **Lighthouse**    | n/a                                               | `pnpm lh` script (`scripts/lighthouse.mjs`) → `apps/web/lighthouse-report.json` — Q9               |
| 36  | **DEVELOPMENT.md**| Missing                                           | Comprehensive onboarding doc (stack table, commands, layout, conventions, troubleshooting)         |
| 37  | **README**        | Stale (mentioned ESLint/Prettier, marked "Phase 1 in progress") | Refreshed: Foundation marked done, Biome scripts, recovery report linked       |
| 38  | **.env.example**  | Per-app only                                      | Root `.env.example` covering both API and Web                                                       |

---

## 3. Creative decisions (within delegated freedoms)

These were chosen by the assistant under the explicit "technical delegation" mandate:

1. **Animation curves** — `cubic-bezier(0.16, 1, 0.3, 1)` for ease-out flows (Apple-style); `cubic-bezier(0.34, 1.56, 0.64, 1)` for the splash logo "pop". Stagger delay: 60 ms between siblings.
2. **Shadow layers** — three named shadows (`shadow-card`, `shadow-card-hover`, `shadow-sheet`) instead of arbitrary opacities, so reuse is consistent.
3. **Color tokens** — Emerald `primary-50..950` exposed both as Tailwind utilities and as CSS variables in `globals.css` (so non-Tailwind libraries / Ionic also pick them up).
4. **Login page background** — three radial gradients layered over a 135° linear gradient using primary-50 → primary-300, finished with a CSS-only film grain (radial-gradient noise pattern at 6 % opacity). No external image.
5. **404 page** — single SVG with three motion-variant groups (numbers float in, magnifying glass pulses, dotted path traces in). All from `framer-motion`, no Lottie dependency.
6. **StatCard 3D tilt** — `whileHover` rotateX/rotateY mapped to `mouseX`/`mouseY` motion values; cap at ±5°; `perspective: 1000px` on container.
7. **Form field order** on Login: username → password → "تذكرني" toggle → submit (matches Yemeni reading flow + standard auth UX).
8. **Icons** — `lucide-react` is the default everywhere; `ionicons` only when an Ionic component requires it (e.g. `IonIcon`).
9. **Breakpoint** — single `desktop: 768px` (matches Ionic split-pane). No tablet sub-breakpoint (Foundation phase).
10. **Vite chunk strategy** — `react-vendor`, `ionic`, `query`, `motion` as named chunks. Ionic remains the largest (1.25 MB raw, 275 KB gzip) but is loaded once and cached by SW.
11. **Splash screen** — pure inline CSS in `index.html` (no JS, no fetched assets) so first-paint is instant; React removes it on `requestAnimationFrame` after mount.
12. **Lint-staged config** — single rule `*.{ts,tsx,js,jsx,json}` → `biome check --write --no-errors-on-unmatched`. No separate Prettier step; Biome handles both.
13. **Test layout** — `__tests__/` folders co-located with source so file moves keep their tests; matches both Vitest and Jest discovery patterns.
14. **Global error envelope** — Arabic default message (`حدث خطأ غير متوقع`) but logs are English. ZodError → 422 with `{ code: 'VALIDATION_ERROR', errors: [{ path, message }] }`.

---

## 4. Files added / removed (high-level)

### Added (representative)

```
prisma/schema.prisma                                  ← 8-model Foundation schema
prisma/seed.ts                                        ← 50+ permissions, 6 roles, owner user
biome.json
DEVELOPMENT.md
.env.example                                          ← root
.husky/pre-commit
scripts/lighthouse.mjs

apps/api/src/common/filters/all-exceptions.filter.ts
apps/api/src/common/interceptors/response-format.interceptor.ts
apps/api/src/common/middleware/request-id.middleware.ts
apps/api/src/common/pipes/zod-validation.pipe.ts
apps/api/src/config/config-validation.schema.ts
apps/api/src/modules/{auth,users,roles,permissions}/* (placeholder modules)
apps/api/src/modules/health/health.controller.spec.ts

apps/web/public/fonts/{ibm-plex-sans-arabic-400..700,jetbrains-mono-400}.woff2
apps/web/public/icons/{icon-72..512,icon-maskable-512,favicon}.svg
apps/web/src/components/ui/*                          ← 13 components
apps/web/src/components/layout/*                      ← 5 components
apps/web/src/components/dashboard/*                   ← 3 widgets
apps/web/src/components/permissions/PermissionGate.tsx
apps/web/src/design/{tokens.ts,fonts.css}
apps/web/src/i18n/ar.ts
apps/web/src/lib/{http,queryClient,cn}.ts
apps/web/src/pages/{LoginPage,DashboardPage,NotFoundPage}.tsx
apps/web/src/routes.tsx
apps/web/src/stores/authStore.ts

packages/shared/vitest.config.ts
packages/shared/src/{utils,schemas,constants}/__tests__/*.test.ts

docs/legacy/foundation-schema-archive.prisma          ← archived 27-model schema
docs/recovery-report.md                               ← this file
```

### Removed

```
.eslintrc.cjs                  apps/api/.eslintrc.cjs                  apps/web/.eslintrc.cjs
eslint.config.mjs              + Prettier configs
apps/api/prisma/schema.prisma  (moved to root)
apps/api/prisma/migrations/    (deleted, gitignored)
apps/api/prisma/seed.{ts,js,d.ts}  (moved to root)
apps/api/tsconfig.seed.json    (no longer needed)
apps/web/src/pages/FoundationPage.tsx   (replaced by real pages)
```

---

## 5. Verification

```bash
# from repo root, on genspark_recovery
pnpm install
pnpm db:generate
pnpm lint                # → Checked 91 files. No fixes applied. (0 errors)
pnpm typecheck           # → 3 packages, all Done
pnpm test                # → 70 tests pass (69 shared + 1 api)
pnpm build               # → 4 workspace builds Done; PWA precache 46 entries / 1814 KiB
pnpm --filter @grocery/shared test:coverage
# → 100% statements / 98.14% branches / 100% functions / 100% lines

# manual smoke
pnpm dev:api             # API on :3001
curl http://localhost:3001/api/v1/health
# {"data":{"status":"ok","database":"ok",...},"meta":{"requestId":"…"}}
curl http://localhost:3001/api/v1/auth/login -XPOST
# 501 {"error":{"code":"NOT_IMPLEMENTED","message":"سيتم تفعيله في المرحلة 2 (Auth)"},…}

pnpm dev:web             # web on :5173
# Splash → LoginPage glass-gradient → /dashboard (3D tilt cards) → /404 (SVG animated)
```

---

## 6. What remains for Phase 2

These are intentionally deferred:

- `RefreshToken` Prisma model (Q3) — to be added with the Auth module.
- Real `/api/v1/auth/*` flows (login, refresh, logout, me).
- Per-route `RolesGuard` + `PermissionsGuard` once `JwtStrategy` is wired.
- First `prisma migrate dev` (Q2) — runs at the start of Phase 2 to lay down the 8 Foundation tables.
- Performance budget tightening: split Ionic into route-level dynamic imports once Phase 2 dashboard pages exist (current Ionic chunk is 1.25 MB / 275 KB gzip — acceptable for v1, target ≤ 200 KB gzip post-Phase 6).
- HTTPS Lighthouse rerun (PWA category requires HTTPS in LH 12; current run validated Performance + A11y + BP + SEO).

Everything else is production-shaped and ready to build on.

---

## 7. Lighthouse summary (2026-04-28)

| Category        | Score | Notes                                              |
| --------------- | ----- | -------------------------------------------------- |
| Performance     | 81    | LCP 4.1 s · TBT 0 ms · CLS 0 · Speed Index 3.1 s   |
| Accessibility   | 92    | RTL, semantic landmarks, focus-visible, label-for  |
| Best Practices  | 96    | HTTPS-only forms, no console errors, modern image  |
| SEO             | 91    | meta description, lang, viewport, robots OK        |

Total transferred: **542 KiB** for first paint. Screenshots: `apps/web/lighthouse-screenshots/{login-mobile,login-desktop,notfound-desktop}.png`. Raw report: `apps/web/lighthouse-report.json` (501 KB JSON).

PWA category audited manually against the build output (`apps/web/dist/`): manifest valid, SW registered (`registerType: 'prompt'`), 9 icons (8 sizes + maskable), `start_url=/`, `scope=/`, `display=standalone`, `dir=rtl`, `lang=ar`, `theme_color=#059669`, all `/api/*` routes use `NetworkOnly`. Offline fallback at `/offline.html`.
