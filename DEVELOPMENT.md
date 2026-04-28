# DEVELOPMENT.md

> Onboarding & day‑to‑day reference for the **Grocery System** monorepo.
> If you're looking for product / architecture decisions, read `docs/12-agent-memory.md` first.

---

## 1. Stack & versions

| Layer            | Technology                                     | Version     |
| ---------------- | ---------------------------------------------- | ----------- |
| Runtime          | Node.js                                        | `>= 20.10`  |
| Package manager  | pnpm                                           | `>= 9.0`    |
| Frontend         | React 18, TypeScript 5.5, Vite 5               | latest      |
| UI shell         | Ionic React 8                                  | `^8.4`      |
| Router           | **React‑Router v5** (locked by Ionic 8 — see Q4) | `^5.3`      |
| Styling          | Tailwind CSS 3 + `tailwindcss-rtl`             | `^3.4`      |
| State / data     | Zustand, TanStack Query 5, Axios               | latest      |
| Animations       | framer‑motion, lucide-react                    | latest      |
| Backend          | NestJS 10                                      | `^10.4`     |
| Validation       | Zod 3                                          | `^3.23`     |
| ORM              | Prisma 5                                       | `^5.22`     |
| Database         | PostgreSQL                                     | `>= 14`     |
| Tests            | Vitest (web + shared), Jest (api)              | latest      |
| Lint / format    | **Biome 1.9** (replaces ESLint + Prettier)     | `1.9.4`     |
| Hooks            | Husky 9 + lint-staged 15                       | latest      |

### Why React-Router v5 (not v6)?

Ionic 8 still bundles `@ionic/react-router` against `react-router@^5`. Forcing
v6 breaks `IonRouterOutlet` page-stack management. We stay on v5 until Ionic
ships first-class v6 support. **Documented exception** — also recorded in
`docs/12-agent-memory.md` (Recovery Phase Decisions, 2026-04-27).

---

## 2. First‑time setup

```bash
# 1. install Node 20 (e.g. via nvm)
nvm use            # reads .nvmrc → 20

# 2. install pnpm if you don't have it
corepack enable
corepack prepare pnpm@9.15.9 --activate

# 3. install workspace deps
pnpm install

# 4. copy env files (root + per-app)
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env

# 5. (Phase 2 onward) database
pnpm db:generate
pnpm db:migrate    # creates prisma/migrations/ — git-ignored in Foundation
pnpm db:seed       # seeds 6 system roles + 50+ permissions + owner user
```

---

## 3. Daily commands

| Command               | What it does                                                |
| --------------------- | ----------------------------------------------------------- |
| `pnpm dev`            | run web (Vite :5173) + api (Nest :3001) in parallel         |
| `pnpm dev:api`        | run only the API                                            |
| `pnpm dev:web`        | run only the web                                            |
| `pnpm build`          | production build for every workspace package                |
| `pnpm lint`           | Biome check (no auto-fix)                                   |
| `pnpm lint:fix`       | Biome check `--write` (safe fixes only)                     |
| `pnpm format`         | Biome format `--write`                                      |
| `pnpm typecheck`      | `tsc --noEmit` in every package                             |
| `pnpm test`           | Vitest (web/shared) + Jest (api), recursive                 |
| `pnpm db:generate`    | regenerate the Prisma client                                |
| `pnpm db:migrate`     | dev migration (adds files to `prisma/migrations/`)          |
| `pnpm db:seed`        | run `prisma/seed.ts`                                        |
| `pnpm db:studio`      | open Prisma Studio                                          |
| `pnpm lh`             | Lighthouse audit on Web build (writes JSON + screenshots)   |

---

## 4. Repository layout

```
grocery-system/
├── apps/
│   ├── api/                    NestJS backend
│   │   ├── src/
│   │   │   ├── common/         filters, interceptors, pipes, middleware
│   │   │   ├── config/         Zod env schema
│   │   │   └── modules/        auth, users, roles, permissions, health
│   │   └── package.json
│   └── web/                    React + Ionic + Vite PWA
│       ├── public/
│       │   ├── fonts/          self-hosted woff2 (Q6)
│       │   └── icons/          PWA icon set + favicon
│       └── src/
│           ├── components/     ui/, layout/, dashboard/, permissions/
│           ├── design/         tokens.ts, fonts.css
│           ├── i18n/           ar.ts
│           ├── lib/            http (axios), queryClient, cn
│           ├── pages/          Login, Dashboard, NotFound
│           ├── stores/         authStore (zustand)
│           └── styles/         globals.css (Tailwind base + components)
├── packages/
│   └── shared/                 cross-cutting types/schemas/permissions/utils
├── prisma/                     ⬅ schema lives at the root (Q5)
│   ├── schema.prisma           8 Foundation models
│   └── seed.ts                 50+ permissions, 6 roles, owner user
├── docs/                       all 13 design docs + recovery report
│   ├── legacy/                 archived schemas & previous artefacts
│   └── 12-agent-memory.md      ⭐ source of truth for decisions
├── .husky/pre-commit           lint-staged via Biome
├── biome.json                  ⬅ at root (Q5)
├── tsconfig.base.json          ⬅ at root (Q5)
├── .nvmrc                      20
├── .env.example                root template — copy to apps too
├── DEVELOPMENT.md              you are here
└── README.md                   short, user-facing
```

---

## 5. Coding conventions

- **Commits** — Conventional Commits (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`).
- **Branches** — work on `genspark_recovery` (or `genspark_ai_developer`); PR into `main`.
- **Lint** — Biome only. ESLint and Prettier configs were removed during recovery.
- **TS strictness** — `strict: true`, but `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are off project-wide for ergonomic React code.
- **Money & decimals** — never use `Float`. Prisma `Decimal(14,2)` everywhere; UI converts via `parseDecimal()` from `@grocery/shared`.
- **i18n** — all user-facing strings are Arabic, all log messages are English.
- **Numbers in UI** — `tabular-nums` + `direction: ltr` on `.num` and table cells; rest of the app is RTL.
- **Permissions** — never hard-code permission strings; import from `@grocery/shared/constants/permissions`.

### Pre‑commit hook (Husky + lint-staged + Biome)

```bash
# .husky/pre-commit  →  pnpm lint-staged
# package.json  →  lint-staged: { "*.{ts,tsx,js,jsx,json}": ["biome check --write --no-errors-on-unmatched"] }
```

Bypass only when truly necessary: `git commit --no-verify`.

---

## 6. Service URLs (local dev)

| Service                 | URL                                       |
| ----------------------- | ----------------------------------------- |
| Web (Vite)              | http://localhost:5173                     |
| API base                | http://localhost:3001/api/v1              |
| Health                  | http://localhost:3001/api/v1/health       |
| Scalar API reference UI | http://localhost:3001/api/v1/docs         |
| OpenAPI JSON            | http://localhost:3001/api/v1/docs-json    |

---

## 7. Lighthouse

```bash
pnpm lh                     # builds web, runs lighthouse, writes JSON + screenshots
```

Output:

```
apps/web/lighthouse-report.json
apps/web/lighthouse-screenshots/
```

---

## 8. Troubleshooting

| Symptom                                    | Fix                                               |
| ------------------------------------------ | ------------------------------------------------- |
| `EADDRINUSE :::3001`                       | `lsof -i :3001 -t \| xargs -r kill`               |
| `Cannot find module '/dist/main.js'`       | `cd apps/api && rm -rf dist tsconfig.tsbuildinfo && pnpm build` |
| Prisma can't find `@prisma/client`         | `pnpm add @prisma/client@5.22.0 -w`               |
| Service Worker keeps stale assets          | DevTools → Application → Service Workers → "Unregister" + hard reload |

---

## 9. Phase status

| Phase | Description                          | Status        |
| ----- | ------------------------------------ | ------------- |
| 0     | Documentation                        | ✅ done       |
| 1     | Foundation (this PR)                 | ✅ done       |
| 2     | Auth + RBAC                          | ⏳ pending    |
| 3+    | Customers, Suppliers, Sales, …       | ⏳ pending    |

Detailed roadmap: `docs/11-development-roadmap.md`.
