# 12 - ذاكرة الوكيل (Agent Memory) — النسخة المعتمدة

> **هذا الملف هو المرجع الثابت.** كل قرار مكتوب هنا تم اعتماده صراحة من المستخدم. لا يجوز تغييره إلا بطلب صريح.
> **آخر تحديث:** 2026-04-27 — بعد جلسة الاعتماد الكاملة (Open Questions + Conflicts + Tech Decisions).

---

## 1. القرارات التقنية الثابتة (Locked)

| البند | القرار النهائي |
|---|---|
| نوع المشروع | نظام إدارة بقالة أونلاين متعدد العمال |
| عدد المتاجر في v1 | بقالة واحدة (مع `storeId` لدعم المتعدد لاحقاً) |
| اللغة | عربي بالكامل (RTL) |
| نوع التطبيق | PWA أونلاين (SW في مرحلة 10 فقط) |
| Frontend | React + TypeScript + Vite + Ionic React + Tailwind |
| Backend | NestJS + TypeScript |
| Database | **Railway PostgreSQL** فقط (ليس Supabase / Neon / غيرها) |
| ORM | Prisma + cuid() built-in IDs |
| Architecture | Monorepo (pnpm workspaces، بدون Turborepo في v1) |
| Deployment | Railway (Frontend + Backend + PostgreSQL) |
| Auth | JWT Access (15 دقيقة) + Refresh httpOnly cookie (7 أيام / 30 مع Remember Me) |
| Hashing | bcrypt rounds=12 |
| RBAC | Dynamic + constraints_json (الحقل موجود لكن غير مستخدم منطقياً في v1) |
| Multi-tenancy | جاهز عبر storeId، غير مفعّل UI في v1 |

---

## 2. القواعد الذهبية (10 — لا تُكسر)

1. ✋ **لا حذف نهائي للعمليات المالية.** فقط `cancelledAt` أو `deletedAt`.
2. 🛡️ **كل العمليات المالية تمر عبر الباكند داخل `prisma.$transaction`.**
3. 📜 **كل عملية حساسة تُسجَّل في `audit_logs`** (مع old_values & new_values).
4. 👁️ **الواجهة تخفي/تظهر** حسب الصلاحيات — تحسين UX فقط.
5. 🔐 **الباكند يتحقق من الصلاحيات** في كل API (PermissionGuard).
6. 🔒 **`SELECT … FOR UPDATE`** إلزامي على `customer.currentBalance` و `supplier.currentBalance` داخل transactions.
7. 🚫 **الفرونت لا يحدّث الأرصدة** أبداً.
8. 📊 **التقارير: 3 صلاحيات منفصلة** — view / print / export.
9. 🆔 **`Idempotency-Key` header إلزامي** على POST لـ /sales, /customer-transactions, /supplier-transactions, /expenses, /purchases.
10. 🗃️ **Railway PostgreSQL فقط.**

---

## 3. القرارات النهائية لـ Open Questions

### A — افتراضات منتجية

| # | السؤال | القرار |
|---|---|---|
| A1 | Dark Mode | ❌ مؤجل لـ v2 |
| A2 | Multi-currency | رمز نصي فقط في settings (لا أسعار صرف) |
| A3 | Branches/Cashiers | store واحد، كل العمال في نفس storeId |
| A4 | Opening Balance | ✅ نعم — `store.openingCashBalance` + `store.openingBalanceDate` + `store.largeTransactionThreshold` (default 50000)، و `customer.openingBalance` و `supplier.openingBalance` |
| A5 | Approval Workflow | v1: رفض مباشر (ForbiddenException). v2: جدول `approval_requests` (TODO comments واضحة) |
| A6 | Negative Customer Balance | ✅ مسموح + badge أزرق "للعميل عند البقالة" + تقرير منفصل "Customer Credits Owed by Store" |
| A7 | PIN vs Password | username + password (bcrypt rounds=12) + Remember Me (refresh 30 يوم) |

### B — تفاصيل تقنية

| # | البند | القرار |
|---|---|---|
| B1 | JWT Storage | Refresh في httpOnly cookie + Access في memory (Zustand) |
| B2 | JWT Lifetimes | 15 دقيقة access + 7 أيام refresh (30 يوم مع Remember Me) |
| B3 | Decimal | `Decimal @db.Decimal(14, 2)` |
| B4 | constraints_json | الحقل موجود في schema، **غير مستخدم منطقياً في v1** (مؤجل لـ v2) |
| B5 | Large Transaction | `settings.large_transaction_threshold` (default 50000) قابل للتكوين |

### C — UI/UX

| # | البند | القرار |
|---|---|---|
| C1 | الخط | **IBM Plex Sans Arabic Variable** (~45KB، self-hosted) + **JetBrains Mono Variable** للأرقام في الجداول. font-display: swap. font-variant-numeric: tabular-nums. |
| C2 | Primary Color | **#059669** (Emerald-600) — الـ palette الكامل في Section 7 |
| C3 | Numerals | إنجليزية 0-9 قاطعاً |
| C4 | Bottom Tabs | 5 تبويبات **ديناميكية حسب الدور** + تبويب "المزيد" يفتح drawer |
| C5 | Modal vs Bottom Sheet | mobile=bottom sheet, desktop=centered modal — نقطة التبديل **768px** |

### D — ميزات أمنية إضافية

| # | البند | القرار |
|---|---|---|
| D1 | refresh_tokens table | ✅ |
| D2 | report_snapshots | ✅ |
| D3 | expense_categories table | ✅ |
| D4 | Idempotency-Key | ✅ إلزامي على /sales, /customer-transactions, /supplier-transactions, /expenses, /purchases |
| D5 | Rate limiting | 5 محاولات / 15 دقيقة على /auth/login + 100 طلب/دقيقة عام |
| D6 | Pagination | `?page=1&limit=20&sort=field:asc` |
| D7 | SELECT FOR UPDATE | إلزامي على Balance updates |

---

## 4. القرارات النهائية لـ Conflicts

| # | الموضوع | القرار النهائي |
|---|---|---|
| C#1 | Service Worker | مرحلة 10 فقط، static assets only. **في المراحل 1-9 لا SW.** |
| C#2 | Cash Purchase | **purchase فقط بدون expense.** Cash Flow ينقص النقد عند `payment_type = cash`. |
| C#3 | daily_summary in sales | منفصل في `daily_incomes`. **يُحذف من sales.sale_mode enum.** |
| C#4 | Permission Refresh | ينتظر refresh الـ token (حتى 15 دقيقة). استثناء: `is_active=false` → revoke refresh_token فوراً → الفرونت يكتشف 401 → logout. |
| C#5 | Mixed Payment | مؤجل لـ v2. v1: `payment_type` enum = `cash` \| `credit` فقط. |

### القاعدة المحاسبية المعتمدة (تُكتب في 10-security-and-audit.md)

```text
- شراء آجل  →  purchase + supplier_transaction (دين+)
- شراء نقدي →  purchase فقط (ينقص النقد في Cash Flow، لا expense منفصل)
- دفع لمورد →  expense(type=supplier_payment) + supplier_transaction (دين-)
- خرج عادي →  expense(type=normal) فقط
```

---

## 5. Technical Stack النهائي (T1-T22)

### Backend

| # | الموضوع | الاختيار |
|---|---|---|
| T1 | Package Manager | **pnpm** (workspaces) |
| T2 | Backend Test | **Jest** |
| T3 | Validation | **Zod + nestjs-zod** — كل DTOs المشتركة في `packages/shared/src/schemas/` |
| T4 | Logger | **nestjs-pino** |
| T5 | API Docs | **Swagger + Scalar UI** — Scalar على `/api/v1/docs`، JSON على `/api/v1/docs-json` |
| T6 | Scheduler | **@nestjs/schedule** (BullMQ في v2) |

### Frontend

| # | الموضوع | الاختيار |
|---|---|---|
| T7 | State | **TanStack Query (server state) + Zustand (auth/permissions/UI)** |
| T8 | HTTP Client | **Axios + TanStack Query** |
| T9 | Forms | **React Hook Form + zodResolver** |
| T10 | Validation FE | **Zod** (موحّد عبر shared) |
| T11 | Date | **dayjs** + `dayjs/plugin/relativeTime` + `dayjs/locale/ar` |
| T12 | i18n | **بدون framework** في v1 — ملف `i18n/ar.ts` فقط (نهاجر لـ react-i18next عند الحاجة) |
| T13 | Animation | **Ionic transitions + Framer Motion + @formkit/auto-animate** |
| T14 | FE Test | **Vitest + React Testing Library** |
| T15 | E2E | **Playwright (مرحلة 10 فقط)** |

### Tooling

| # | الموضوع | الاختيار |
|---|---|---|
| T16 | Linter/Formatter | **Biome** — config واحد في الجذر يطبق على المونوريبو كله |
| T17 | Git Hooks | **Husky + lint-staged** |
| T18 | Monorepo Tool | **pnpm workspaces** فقط (لا Turborepo) |
| T19 | Print/Export | **window.print() + CSS @media print** + CSV export بسيط. **لا PDF generation في v1.** |
| T20 | Cache | **بدون Redis في v1** |
| T22 | IDs | **Prisma `cuid()`** built-in |

---

## 6. أوضاع البيع المعتمدة (محدّثة)

```text
sales.sale_mode enum:
  detailed       : بيع تفصيلي بأصناف وكميات (يسمح بربح دقيق).
  quick_amount   : بيع سريع بمبلغ + تفاصيل نصية حرة.
  -- (تم حذف daily_summary من هنا — انتقل لجدول daily_incomes منفصل)

sales.payment_type enum:
  cash      : نقدي
  credit    : آجل (ينشئ customer_transaction نوع debt)
  -- (تم حذف mixed — مؤجل لـ v2)

mode النظام (settings.sales_mode):
  detailed | quick | daily | hybrid (الافتراضي)
```

---

## 7. الـ Design System المعتمد (Tokens الكاملة)

### Color Palette
```typescript
colors.brand = {
  primary:      '#059669',  // emerald-600
  primaryDark:  '#047857',  // emerald-700
  primaryLight: '#10B981',  // emerald-500
  accent:       '#0EA5E9',  // sky-500
}
colors.surface = {
  bg:       '#FAFAF9',  // stone-50
  card:     '#FFFFFF',
  elevated: '#F5F5F4',  // stone-100
  overlay:  'rgba(0,0,0,0.4)',
}
colors.semantic = {
  success: '#10B981',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#3B82F6',
}
colors.text = {
  primary:   '#18181B',  // zinc-900
  secondary: '#52525B',  // zinc-600
  tertiary:  '#A1A1AA',  // zinc-400
  inverse:   '#FAFAFA',
}
colors.border = {
  default: '#E4E4E7',  // zinc-200
  subtle:  '#F4F4F5',  // zinc-100
  strong:  '#D4D4D8',  // zinc-300
}
```

### Spacing (8-point grid)
`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96` px

### Border Radius
`sm:6 · md:10 · lg:14 · xl:20 · 2xl:28 · full:9999` px

### Shadows (3-layer premium)
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06);
--shadow-md: 0 2px 4px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04);
--shadow-lg: 0 4px 8px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.06), 0 16px 32px rgba(0,0,0,0.08);
--shadow-glow-primary: 0 0 0 4px rgba(5,150,105,0.12);
```

### Animation Curves (Linear.app inspired)
```css
--ease-out-expo:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
```

### Typography
- **Sans:** IBM Plex Sans Arabic Variable (self-hosted)
- **Mono:** JetBrains Mono Variable (self-hosted)
- **Numerals:** `font-variant-numeric: tabular-nums` على كل الجداول والإحصاءات
- **Numerals form:** Latin (0-9) قاطعاً

### Breakpoints
```typescript
sm:  640px
md:  768px   // ← نقطة تبديل layout (mobile/desktop)
lg:  1024px
xl:  1280px
2xl: 1536px
```

---

## 8. Bottom Tabs Configuration (حسب الدور)

```typescript
const BOTTOM_TABS_BY_ROLE = {
  sales_worker:      ['home', 'sales', 'customers', 'debts', 'more'],
  manager:           ['home', 'sales', 'reports', 'notifications', 'more'],
  accountant:        ['home', 'reports', 'customers', 'suppliers', 'more'],
  inventory_officer: ['home', 'products', 'inventory', 'purchases', 'more'],
  owner:             ['home', 'sales', 'reports', 'notifications', 'more'], // قابل للتخصيص
};
```
تبويب "المزيد" يفتح Drawer/Sidebar كامل بكل ميزات الدور.

---

## 9. Folder Structure المعتمد

```text
grocery-system/
├── apps/
│   ├── api/         # NestJS + Prisma
│   └── web/         # React + Vite + Ionic + Tailwind
├── packages/
│   ├── shared/      # zod schemas, types, constants (permissions, roles)
│   └── config/      # tsconfig.base.json, biome.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/.gitkeep
│   └── seed.ts
├── docs/
├── .env.example
├── .gitignore
├── .nvmrc           # 20
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── README.md
└── DEVELOPMENT.md
```

---

## 10. ميزات v1 المعتمدة

✅ Auth (login + JWT + Refresh + Remember Me 30 يوم)
✅ RBAC ديناميكي (مع constraints_json field فقط، بدون منطق v1)
✅ Users + Roles + Permissions
✅ Customers (مع openingBalance + رصيد سالب مسموح + badge أزرق)
✅ Customer Transactions (debt/payment/adjustment/clearance + cancel)
✅ Sales (detailed/quick، cash/credit فقط)
✅ Daily Income (منفصل عن sales)
✅ Suppliers (مع openingBalance) + Supplier Transactions
✅ Purchases (total_only/detailed، cash/credit) — Cash purchase: purchase فقط
✅ Expenses (normal/supplier_payment) — Supplier payment يخفض رصيد التاجر
✅ Products + Inventory (اختياري)
✅ Reports (دقيق/تقديري/يدوي + view/print/export)
✅ Notifications + WhatsApp button (يدوي)
✅ Customer Reminders + Behavior Analysis
✅ Audit Logs (لا يُحذف)
✅ PWA (SW في مرحلة 10 فقط)

---

## 11. ميزات مؤجلة (v2)

❌ Dark Mode
❌ Multi-currency فعلي (أسعار صرف)
❌ Multi-tenant UI
❌ Approval Workflow Table (`approval_requests`)
❌ constraints_json logic
❌ Mixed payment type في sales
❌ Offline financial operations
❌ WhatsApp API automatic
❌ Native mobile / desktop apps
❌ Images/media
❌ E-payment
❌ Hardware integrations (barcode/printers)
❌ Customer-facing app
❌ BullMQ + Redis
❌ Turborepo
❌ react-i18next
❌ PDF generation backend

---

## 12. خارطة الطريق (10 مراحل)

1. **Foundation** ← الحالية
2. Auth + RBAC
3. Customers + Debts
4. Suppliers + Purchases
5. Expenses + Daily Income
6. Sales Modes
7. Reports
8. Notifications + WhatsApp
9. Inventory (Optional)
10. Polish + PWA + Deployment

> الترتيب ملزم. لا انتقال قبل قبول المرحلة الحالية.

---

## 13. Naming Conventions

| الموضوع | الصيغة |
|---|---|
| Permission code | `customer_transactions.create_debt` (snake.dot) |
| API path | `/customer-transactions/debt` (kebab) |
| DB tables/columns | `customer_transactions`, `current_balance` (snake) |
| Prisma model fields | camelCase (مثل `currentBalance`) مع `@map("current_balance")` |
| TS types/classes | PascalCase |
| TS variables/functions | camelCase |
| React components | PascalCase |
| Component files | PascalCase (`AppButton.tsx`) |
| API files | kebab-case |

---

## 14. حالة المشروع الحالية

```text
المرحلة          : 1 - Foundation
الكود            : قيد التنفيذ
Branch           : genspark_ai_developer
آخر commit      : a93fe0f (docs only)
السماح بـ Auth   : ❌ placeholders فقط
السماح بـ DB push: ❌ schema validate/format فقط
```

---

## 15. حقوق التغيير

أي تغيير على هذا الملف يحتاج موافقة صريحة من المستخدم. الملفات الأخرى في `docs/` يجب أن تبقى متسقة مع هذا الملف.
