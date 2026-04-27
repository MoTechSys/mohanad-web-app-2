# Grocery System (نظام إدارة البقالة)

> نظام إدارة بقالة أونلاين متكامل (PWA) — عربي بالكامل (RTL)
> Stack: **React + TS + Vite + Ionic + Tailwind** | **NestJS + TypeScript** | **Prisma + Railway PostgreSQL**

## الحالة الحالية

| المرحلة | الوصف | الحالة |
|---|---|---|
| 0 | التحليل والتوثيق | ✅ مكتمل (`docs/00..12`) |
| **1** | **Foundation (Monorepo + Schema + Shells)** | 🔄 **قيد التنفيذ** |
| 2 | Auth + RBAC | ⏳ |
| 3 | Customers + Debts | ⏳ |
| 4 | Suppliers + Purchases | ⏳ |
| 5 | Expenses + Daily Income | ⏳ |
| 6 | Sales Modes | ⏳ |
| 7 | Reports | ⏳ |
| 8 | Notifications + WhatsApp | ⏳ |
| 9 | Inventory (optional) | ⏳ |
| 10 | Polish + PWA + Deployment | ⏳ |

## بنية المشروع (Monorepo — pnpm workspaces)

```
grocery-system/
├── apps/
│   ├── api/          # NestJS backend (REST + Prisma + JWT + RBAC)
│   └── web/          # React PWA (Vite + Ionic + Tailwind + RTL)
├── packages/
│   └── shared/       # types, zod schemas, PERMISSIONS, constants
├── docs/             # 13 ملف توثيق معتمد
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## المتطلبات

- Node.js **>= 20.10.0**
- pnpm **>= 9.0.0**
- PostgreSQL **>= 14** (محلياً للتطوير، Railway للإنتاج)

## البدء السريع

```bash
# 1. تثبيت الاعتماديات
pnpm install

# 2. إعداد متغيرات البيئة
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. إنشاء قاعدة البيانات وتشغيل seed
pnpm db:migrate
pnpm db:seed

# 4. تشغيل dev servers (api على 3001، web على 5173)
pnpm dev
```

## السكربتات الجذرية

| السكربت | الوصف |
|---|---|
| `pnpm dev` | تشغيل web + api بالتوازي |
| `pnpm dev:api` | تشغيل الباكند فقط |
| `pnpm dev:web` | تشغيل الفرونت فقط |
| `pnpm build` | بناء الإنتاج لجميع الحزم |
| `pnpm lint` | فحص ESLint |
| `pnpm format` | تنسيق Prettier |
| `pnpm typecheck` | فحص الأنواع |
| `pnpm test` | تشغيل الاختبارات |
| `pnpm db:migrate` | تشغيل migrations |
| `pnpm db:seed` | seed بيانات الصلاحيات والأدوار والمالك |
| `pnpm db:studio` | فتح Prisma Studio |

## التوثيق

راجع مجلد [`docs/`](./docs):

- [`00-project-overview.md`](./docs/00-project-overview.md)
- [`01-requirements-analysis.md`](./docs/01-requirements-analysis.md)
- [`02-architecture.md`](./docs/02-architecture.md)
- [`03-database-design.md`](./docs/03-database-design.md)
- [`04-rbac-permissions.md`](./docs/04-rbac-permissions.md)
- [`05-ui-ux-guidelines.md`](./docs/05-ui-ux-guidelines.md)
- [`06-modules.md`](./docs/06-modules.md)
- [`07-api-plan.md`](./docs/07-api-plan.md)
- [`08-reports.md`](./docs/08-reports.md)
- [`09-notifications.md`](./docs/09-notifications.md)
- [`10-security-and-audit.md`](./docs/10-security-and-audit.md)
- [`11-development-roadmap.md`](./docs/11-development-roadmap.md)
- [`12-agent-memory.md`](./docs/12-agent-memory.md) ← **القرارات الثابتة**

## الترخيص

Private — proprietary.
