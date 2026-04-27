# 12 - ذاكرة الوكيل (Agent Memory)

> **هذا الملف هو المرجع الثابت.** كل قرار مكتوب هنا يجب احترامه في كل خطوة لاحقة. لا يجوز تغييره إلا بطلب صريح من المستخدم.

## 1. القرارات التقنية الثابتة

| البند | القرار النهائي |
|---|---|
| نوع المشروع | نظام إدارة بقالة أونلاين متعدد العمال. |
| عدد المتاجر في v1 | بقالة واحدة (مع `store_id` لدعم المتعدد لاحقاً). |
| اللغة | عربي بالكامل (RTL). |
| نوع التطبيق | PWA أونلاين. |
| Frontend | React + TypeScript + Vite + **Ionic React** + Tailwind. |
| Backend | NestJS + TypeScript. |
| Database | **Railway PostgreSQL** (ليس Supabase ولا Neon ولا غيرها). |
| ORM | Prisma. |
| Architecture | Monorepo (pnpm workspaces). |
| Deployment | Railway للفرونت + الباك + قاعدة البيانات. |
| Auth | JWT Access + Refresh tokens (rotation). |
| Hashing | bcrypt. |
| RBAC | Dynamic (الأدمن يصنع الأدوار ويوزع الصلاحيات). |
| Multi-tenancy | جاهز عبر store_id، لكن غير مفعّل في v1. |

> ✋ هذه القرارات **لا تتغير** بدون طلب صريح.

## 2. القواعد الذهبية (لا تُكسر)

1. **لا حذف نهائي للعمليات المالية.** فقط `cancelled_at` أو `deleted_at`.
2. **كل العمليات المالية داخل `prisma.$transaction`.** بدون استثناء.
3. **الفرونت لا يحدّث الأرصدة مباشرة.** الباكند فقط.
4. **كل API محمي بـ JwtAuthGuard + PermissionGuard.**
5. **كل عملية حساسة تكتب في `audit_logs`** (مع old_values & new_values).
6. **الواجهة تخفي/تظهر حسب الصلاحيات** لكنها ليست الحماية الفعلية.
7. **الباكند يتحقق من الصلاحيات** في كل طلب.
8. **التقارير لها 3 صلاحيات منفصلة:** view / print / export.
9. **العمليات المالية المهمة تتطلب موافقة** عند تجاوز سقف أو مبلغ كبير (constraints_json).
10. **قاعدة البيانات Railway PostgreSQL فقط.** ممنوع غيرها.

## 3. أوضاع البيع المعتمدة

```text
1. detailed       : بيع تفصيلي بأصناف وكميات (يسمح بحساب ربح دقيق).
2. quick_amount   : بيع سريع بمبلغ + تفاصيل نصية حرة.
3. daily_summary  : دخل يومي إجمالي (بدون تفاصيل بيع).
4. hybrid         : النظام يسمح بأكثر من وضع في نفس الوقت (الافتراضي لـ v1).
```

## 4. أوضاع حساب الربح

```text
profit_calculation_mode:
  accurate_by_sales_items       : دقيق (يحتاج بيع تفصيلي + تكلفة).
  estimated_by_daily_income     : تقديري (دخل يومي - مصاريف).
  manual_cogs                   : المالك يدخل تكلفة البضاعة المباعة يدوياً.
```

كل تقرير يجب أن يعرض **accuracy** (accurate / estimated / manual) بوضوح.

## 5. القواعد المالية الحاسمة

- **سداد عميل ≠ ربح جديد** (إذا الدين مسجل سابقاً كبيع، السداد دخول نقدي فقط).
- **دفع لتاجر ≠ خسارة جديدة** (سداد التزام سابق، يخفض رصيد التاجر، **لا يدخل** في الربح والخسارة).
- **مشتريات نقدية**: تسجل expense من نوع `cash_purchase`، لا تلمس رصيد التاجر.
- **مشتريات آجلة**: ترفع رصيد التاجر، لا تظهر مباشرة في cash_flow.
- **بيع آجل**: ينشئ debt للعميل، يدخل في profit (إن متوفرة التكلفة) لكن لا يدخل في cash_flow حتى السداد.
- **بيع نقدي**: يدخل في cash_flow + profit.

## 6. المخزون

```text
- المخزون اختياري في v1.
- إعداد عام: inventory_enabled = true / false.
- لكل منتج: track_inventory = true / false.
- إذا غير مفعّل: لا تتغير الكميات تلقائياً، لا تنبيهات نقص، لا يمنع البيع.
- إذا مفعّل: المشتريات التفصيلية تزيد، البيع التفصيلي ينقص، تنبيهات نقص.
- تخزين الكمية في products.current_quantity، لا تُعدَّل إلا عبر stock_movements.
```

## 7. الصلاحيات (مرجع)

> القائمة الكاملة في `04-rbac-permissions.md`. الأقسام:
> system, users, roles, permissions, customers, customer_transactions, sales, daily_income, expenses, suppliers, supplier_transactions, purchases, products, inventory, stock_movements, reports (view/print/export), notifications, audit_logs.

الأدوار الافتراضية (seed): Owner, Manager, Sales Worker, Accountant, Purchasing Officer, Inventory Officer.

## 8. ميزات v1 (مفعّلة)

- ✅ تسجيل دخول + JWT + Refresh.
- ✅ RBAC ديناميكي.
- ✅ إدارة المستخدمين والأدوار.
- ✅ العملاء + ديونهم + سداد + سقف + تجميد + مهلة.
- ✅ التجار + المشتريات (نقدي/آجل، إجمالي/تفصيلي).
- ✅ المصاريف + دفع التجار + cash_purchase.
- ✅ الدخل اليومي.
- ✅ البيع (3 أوضاع + هجين).
- ✅ المخزون اختياري.
- ✅ التقارير (يومي/أسبوعي/شهري/ربح/تدفق/مخزون/...).
- ✅ الإشعارات الداخلية.
- ✅ زر واتساب برسالة جاهزة.
- ✅ تذكيرات العملاء.
- ✅ تحليل سلوك العملاء.
- ✅ Audit Logs.
- ✅ PWA.
- ✅ طباعة وتصدير التقارير (بصلاحيات).

## 9. ميزات مؤجلة (بعد v1)

- ❌ واتساب API تلقائي.
- ❌ متعدد المتاجر فعلياً (UI).
- ❌ أوفلاين للعمليات المالية.
- ❌ تطبيق موبايل أصلي / سطح مكتب.
- ❌ صور وميديا.
- ❌ تكامل دفع إلكتروني.
- ❌ باركود متقدم / طابعات حرارية.
- ❌ تطبيق للعميل النهائي.

## 10. هيكل المشروع المعتمد

```text
grocery-system/
├── apps/
│   ├── api/              # NestJS + Prisma
│   └── web/              # React + Vite + Ionic + Tailwind
├── packages/
│   └── shared/           # types, permissions, validation
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/                 # ملفات التوثيق
├── pnpm-workspace.yaml
└── package.json
```

## 11. الأسماء والكونفنشنز المعتمدة

- **Permission code:** snake_case.dot — `customer_transactions.create_debt`.
- **API path:** kebab-case — `/customer-transactions/debt`.
- **DB tables/columns:** snake_case — `customer_transactions`, `current_balance`.
- **TS types/interfaces:** PascalCase — `CustomerTransaction`.
- **TS variables/functions:** camelCase.
- **Component names:** PascalCase.
- **File names:** kebab-case في الباك، PascalCase للمكونات في الفرونت.

## 12. المتغيرات الموحدة (WhatsApp & Notifications)

```text
{customer_name}
{balance}
{currency}
{store_name}
{last_transaction_date}
{today_date}
{user_name}
{amount}
```

## 13. خارطة الطريق (10 مراحل)

1. Foundation
2. Auth + RBAC
3. Customers + Debts
4. Suppliers + Purchases
5. Expenses + Daily Income
6. Sales Modes
7. Reports
8. Notifications + WhatsApp
9. Inventory (Optional)
10. Polish + PWA + Deployment

> الترتيب ملزم. لا انتقال للمرحلة التالية قبل قبول المرحلة الحالية.

## 14. حقوق التغيير

- أي تغيير على هذا الملف يحتاج موافقة صريحة من المستخدم.
- إن طلب المستخدم تغييراً، يُحدَّث الملف مع توضيح ما تغيّر ولماذا.
- الملفات الأخرى في `docs/` يجب أن تبقى متسقة مع هذا الملف.

## 15. حالة الذاكرة الحالية

```text
المرحلة الحالية : التحليل والتوثيق (قبل البدء بالكود).
الكود          : لم يُكتب بعد.
ينتظر          : إذن صريح من المستخدم: "ابدأ التنفيذ".
```
