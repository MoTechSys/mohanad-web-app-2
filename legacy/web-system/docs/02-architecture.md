# 02 - المعمارية النهائية

## 1. ملخص القرار التقني

```text
Frontend  : React + TypeScript + Vite + Ionic React + Tailwind CSS (PWA)
Backend   : NestJS + TypeScript (REST API)
Database  : Railway PostgreSQL
ORM       : Prisma
Repo      : Monorepo
Deploy    : Railway (Frontend + Backend + PostgreSQL)
Auth      : JWT Access + Refresh Tokens
RBAC      : Dynamic permissions
Audit     : audit_logs table on every important operation
```

> **قرار ثابت:** قاعدة البيانات Railway PostgreSQL فقط. ممنوع استخدام Supabase أو Neon أو أي خدمة خارجية.

## 2. مخطط البنية (High-Level)

```text
┌──────────────────────────────────────┐
│   Mobile / Browser (Worker, Manager) │
└─────────────────┬────────────────────┘
                  │ HTTPS
                  ▼
┌──────────────────────────────────────┐
│  Frontend PWA (Railway)              │
│  React + Vite + Ionic + Tailwind     │
│  - RTL Arabic UI                     │
│  - Service Worker (cache UI only)    │
│  - JWT in memory + Refresh token     │
└─────────────────┬────────────────────┘
                  │ REST + JSON + JWT
                  ▼
┌──────────────────────────────────────┐
│  Backend API (Railway)               │
│  NestJS + TypeScript                 │
│  - Auth Module + Guards              │
│  - PermissionGuard (RBAC)            │
│  - Modules per domain                │
│  - Prisma Service                    │
│  - Audit Interceptor                 │
└─────────────────┬────────────────────┘
                  │ Prisma Client
                  ▼
┌──────────────────────────────────────┐
│  Railway PostgreSQL                  │
│  - Migrations via Prisma             │
│  - Indexes on store_id + dates       │
└──────────────────────────────────────┘
```

## 3. هيكل المونوريبو

```text
grocery-system/
├── apps/
│   ├── web/                    # Frontend PWA
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── features/       # per module
│   │   │   ├── hooks/
│   │   │   ├── lib/api/        # axios + react-query
│   │   │   ├── lib/permissions/
│   │   │   ├── lib/i18n/
│   │   │   ├── store/
│   │   │   └── styles/
│   │   ├── public/             # PWA manifest, icons
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   │
│   └── api/                    # Backend NestJS
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── roles/
│       │   │   ├── permissions/
│       │   │   ├── customers/
│       │   │   ├── customer-transactions/
│       │   │   ├── sales/
│       │   │   ├── daily-income/
│       │   │   ├── suppliers/
│       │   │   ├── supplier-transactions/
│       │   │   ├── purchases/
│       │   │   ├── expenses/
│       │   │   ├── products/
│       │   │   ├── inventory/
│       │   │   ├── notifications/
│       │   │   ├── reports/
│       │   │   ├── audit-logs/
│       │   │   └── settings/
│       │   ├── common/
│       │   │   ├── guards/        # JwtGuard, PermissionGuard
│       │   │   ├── decorators/    # @Permissions(), @CurrentUser()
│       │   │   ├── interceptors/  # AuditInterceptor
│       │   │   ├── filters/       # Exception filters
│       │   │   └── pipes/
│       │   ├── prisma/
│       │   │   └── prisma.service.ts
│       │   ├── config/
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── test/
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── permissions/   # PERMISSION_CODES enum/const
│       │   ├── types/         # shared TS types/DTOs
│       │   ├── constants/
│       │   └── validation/    # zod schemas
│       └── package.json
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                # seed roles, permissions, owner
│
├── docs/                      # this folder
├── .env.example
├── package.json               # workspaces / pnpm
├── pnpm-workspace.yaml
├── turbo.json (optional)
└── README.md
```

## 4. الطبقات داخل الباكند (NestJS)

```text
Controller   → يستقبل HTTP و يطبق Guards و يرجع DTOs
Service      → منطق العمل، يستدعي Prisma داخل transactions
Repository?  → داخل Service مباشرة (نستخدم Prisma بدون Repository pattern معقد)
Guards       → JwtAuthGuard + PermissionGuard
Interceptors → AuditInterceptor (يكتب audit_log بعد العمليات الناجحة)
Pipes        → ValidationPipe + ZodPipe
DTOs         → input/output validation
```

## 5. RBAC Flow

```text
Request → JwtAuthGuard
       → يثبت من JWT و يحقن user
       → PermissionGuard
       → يقرأ الصلاحيات المطلوبة من @Permissions('customers.create')
       → يقرأ صلاحيات user المخزنة (cache أو DB)
       → إذا ناقصة → 403 Forbidden + audit_log permission_denied_attempt
       → إذا OK → Controller → Service
       → Service ينفذ داخل prisma.$transaction
       → AuditInterceptor يكتب audit_log
       → Response
```

## 6. PWA & Service Worker

- PWA manifest (RTL، اسم عربي، أيقونات).
- Service Worker يحفظ static assets فقط.
- العمليات المالية (POST/PUT/DELETE) **لا تعمل أوفلاين** في v1.
- الواجهة قد تفتح من الكاش مع رسالة "لا يوجد اتصال".

## 7. الأمان

- HTTPS فقط (Railway يتولى).
- JWT Access (قصير 15 دقيقة) + Refresh (طويل 7 أيام).
- bcrypt لكلمات المرور.
- Helmet + CORS صارم.
- Rate limiting على login.
- Validation على كل DTO.
- SQL Injection ممنوع (Prisma).
- Audit log لكل محاولة دخول وكل محاولة وصول مرفوضة.

## 8. Database Transactions

كل عملية مالية يجب أن تستخدم `prisma.$transaction`:

```ts
await prisma.$transaction(async (tx) => {
  await tx.customer.update({ ... });
  await tx.customerTransaction.create({ ... });
  await tx.auditLog.create({ ... });
  await tx.notification.create({ ... });
});
```

## 9. Multi-Tenancy جاهز

- كل الجداول المهمة فيها `store_id`.
- في v1 store واحد ثابت في الإعدادات.
- لاحقاً يمكن تفعيل tenant guard عبر JWT.

## 10. أدوات التطوير

- pnpm workspaces (أو npm).
- ESLint + Prettier.
- Husky + lint-staged.
- Jest للتيستات.
- Prisma Studio للمراجعة.
