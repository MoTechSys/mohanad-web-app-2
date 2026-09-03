# 11 - خارطة طريق التنفيذ (Development Roadmap)

> تنفيذ تدريجي على 10 مراحل. كل مرحلة لها مخرجات قابلة للاختبار قبل الانتقال للتالية.

## نظرة عامة

```text
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
```

---

## المرحلة 1 — Foundation (الأساس)

**الهدف:** هيكل المشروع جاهز للتطوير.

**الباكند:**
- إنشاء monorepo (pnpm workspaces).
- إنشاء `apps/api` (NestJS).
- إعداد Prisma + اتصال Railway PostgreSQL.
- إنشاء `prisma/schema.prisma` فيه كل الجداول الأساسية.
- أول migration ناجح.
- `prisma/seed.ts` يبذر:
  - store واحد.
  - permissions كاملة (من 04-rbac).
  - الأدوار الافتراضية (Owner/Manager/Sales/Accountant/Purchasing/Inventory).
  - مستخدم Owner أول.
  - settings الافتراضية.
- إعداد ConfigModule, PrismaService, Logger, Helmet, CORS, Validation, Throttler.
- AuditInterceptor + AuditService.

**الفرونت:**
- إنشاء `apps/web` بـ Vite + React + TS.
- تثبيت Ionic React + Tailwind + RTL.
- إعداد PWA manifest + Service Worker.
- إعداد axios + react-query.
- نظام الراوتر + AppLayout.
- ThemeProvider + i18n عربي.
- مكونات UI أساسية: Button, Input, Card, Sheet, Toast, Spinner.

**Shared:**
- `packages/shared` فيه: `PERMISSIONS` const, types مشتركة, zod schemas.

**Deliverable:** المشروع يبني محلياً، migration ناجحة، seed يعمل، الفرونت يفتح صفحة فارغة.

---

## المرحلة 2 — Auth + RBAC

**الهدف:** تسجيل الدخول والصلاحيات تعمل بالكامل.

**الباكند:**
- موديول `auth`: login, refresh, logout, me, change-password.
- JWT Strategy + Refresh tokens.
- موديول `users`: CRUD + activate/deactivate + assign_roles + reset_password.
- موديول `roles`: CRUD + clone + assign_permissions.
- موديول `permissions`: list + grouped.
- `PermissionGuard` يعمل على كل endpoint.
- Audit logs لكل أحداث الدخول والصلاحيات.

**الفرونت:**
- شاشة تسجيل الدخول.
- تخزين tokens + refresh تلقائي.
- `useCurrentUser`, `usePermissions`, `<Can>`.
- شاشات إدارة المستخدمين والأدوار (للمدير/المالك).
- شجرة صلاحيات بـ checkboxes.
- Logout.

**Deliverable:** المالك يدخل، يصنع أدواراً، يضيف عمالاً، يخصص صلاحيات. كل APIs محمية.

---

## المرحلة 3 — Customers + Debts

**الهدف:** إدارة العملاء وديونهم بالكامل.

**الباكند:**
- موديول `customers`: CRUD + soft delete + restore.
- credit_limit + status (active/frozen/grace).
- freeze / unfreeze / grant_grace / clear_account / credit_limit update.
- موديول `customer-transactions`: debt / payment / adjustment / clearance.
- التحقق من سقف الدين + approve_over_limit + approve_large_amount.
- Cancel transaction + audit.
- كشف حساب.
- كل العمليات داخل `prisma.$transaction`.

**الفرونت:**
- قائمة العملاء (بحث + filters + Mobile cards).
- صفحة تفاصيل العميل + كشف حساب (timeline).
- شاشة إضافة دين (نموذج بسيط: مبلغ + تفاصيل).
- شاشة سداد.
- شاشة تجميد/مهلة/تصفير.
- زر طباعة كشف حساب.

**Deliverable:** عمال يضيفون ديون ويسجلون سداد، الأرصدة تتحدث بدقة، التجاوز يتطلب موافقة، Audit يسجل كل شيء.

---

## المرحلة 4 — Suppliers + Purchases

**الهدف:** إدارة التجار والمشتريات.

**الباكند:**
- موديول `suppliers`: CRUD + opening_balance + soft delete.
- موديول `supplier-transactions`: credit_purchase / payment / adjustment + cancel.
- موديول `purchases`: total_only + detailed_items, cash + credit.
  - cash: لا يلمس supplier balance، ينشئ expense (cash_purchase).
  - credit: يرفع supplier balance + supplier_transaction.
- موديول `products` بداية بسيطة (للـ purchases التفصيلية).
- كل العمليات داخل transactions.

**الفرونت:**
- قائمة التجار + كشف حساب.
- شاشة شراء إجمالي.
- شاشة شراء تفصيلي (أصناف + كميات + سعر).
- شاشة دفع لتاجر.
- طباعة فاتورة شراء.

**Deliverable:** مسؤول المشتريات يسجل مشتريات، رصيد التاجر يتحدث، الإلغاء يعكس الأثر.

---

## المرحلة 5 — Expenses + Daily Income

**الهدف:** الخرج والدخل اليومي.

**الباكند:**
- موديول `expenses`: normal / supplier_payment / cash_purchase / other.
- expense_categories (CRUD).
- supplier_payment ينشئ supplier_transaction نوع payment.
- موديول `daily-income`: 1 سجل/يوم/store، unique constraint.
- approve / cancel / audit.

**الفرونت:**
- قائمة المصاريف + filters.
- شاشة إضافة خرج عادي.
- شاشة دفع لتاجر (اختيار التاجر + المبلغ).
- إدارة تصنيفات المصاريف.
- شاشة دخل يومي (واحد لكل يوم).

**Deliverable:** المالك يدخل دخل اليوم، يسجل المصاريف ودفع التجار، التقارير الأولية تبدأ في الظهور.

---

## المرحلة 6 — Sales Modes

**الهدف:** البيع بأوضاعه الثلاثة.

**الباكند:**
- موديول `sales`:
  - quick_amount: مبلغ + نص حر.
  - detailed: sale_items مع unit_cost / unit_price.
  - daily_summary: يربط بـ daily_income (وضع موحّد).
- payment_type: cash / credit / mixed.
- credit ينشئ customer_transaction نوع debt.
- close_day, refund, discount.
- view_profit (محسوب من sale_items.total_cost vs total_price).
- cancel يعكس debt + (لاحقاً) المخزون.

**الفرونت:**
- شاشة بيع سريع (مبلغ + عميل اختياري + نقد/دين + تفاصيل نصية).
- شاشة بيع تفصيلي (إضافة أصناف + كميات + إجمالي).
- إيصال بيع + طباعة.
- إغلاق اليوم.

**Deliverable:** عمال يبيعون بأوضاع متعددة، الديون تنشأ تلقائياً للبيع الآجل، الأرباح تُحسب للبيع التفصيلي.

---

## المرحلة 7 — Reports

**الهدف:** التقارير الأساسية مع 3 مستويات صلاحيات.

**الباكند:**
- موديول `reports`:
  - dashboard.
  - daily / weekly / monthly summary.
  - profit_loss (3 أوضاع).
  - cash_flow.
  - sales / customer_debts / supplier_debts / purchases / expenses.
  - user_activity / audit.
- وسوم accuracy: accurate / estimated / manual.
- print endpoints (HTML/PDF).
- export endpoints (xlsx/csv/pdf).

**الفرونت:**
- شاشة Dashboard مع بطاقات.
- شاشات تقارير + filters (date range, customer, supplier, ...).
- زر طباعة (`reports.print.*`).
- زر تصدير (`reports.export.*`).
- وسم "تقرير دقيق / تقديري" واضح في الواجهة.

**Deliverable:** كل التقارير الأساسية تعمل، الصلاحيات الثلاث منفصلة (view/print/export).

---

## المرحلة 8 — Notifications + WhatsApp

**الهدف:** إشعارات داخلية + زر واتساب + تذكيرات العملاء + تحليل سلوك.

**الباكند:**
- موديول `notifications` كامل + templates + scheduled_jobs.
- `@nestjs/schedule`:
  - daily_income_check (بعد deadline).
  - monthly_profit_report.
  - customer_reminders حسب الجدولة.
  - behavior_analysis ليلاً.
  - low_stock_check (إن المخزون مفعل).
- WhatsApp log endpoint.

**الفرونت:**
- جرس إشعارات + قائمة + mark_read.
- زر واتساب في صفحة العميل + كشف حسابه.
- شاشة إعداد تذكير العميل.
- شاشة قوالب الرسائل.
- تنبيهات تحليل السلوك.

**Deliverable:** المدير يستلم تنبيهات تلقائية، يفتح واتساب برسالة جاهزة، يجدول تذكيرات.

---

## المرحلة 9 — Inventory (Optional)

**الهدف:** تفعيل المخزون اختيارياً.

**الباكند:**
- إعداد `inventory_enabled` global.
- `track_inventory` per product.
- `stock_movements`: in / out / adjust + cancel.
- ربط تلقائي:
  - purchase detailed + inventory enabled → in.
  - sale detailed + inventory enabled → out.
- low_stock notifications.
- تقارير المخزون.

**الفرونت:**
- شاشة المنتجات (CRUD).
- toggle inventory_enabled في الإعدادات.
- toggle track_inventory لكل منتج.
- شاشة حركات المخزون.
- تنبيهات نقص.
- تقرير مخزون.

**Deliverable:** المالك يفعل المخزون بضغطة، الكميات تتحدث تلقائياً مع البيع/الشراء التفصيلي.

---

## المرحلة 10 — Polish + PWA + Deployment

**الهدف:** الجاهزية للإنتاج.

**Polish:**
- مراجعة UX كاملة.
- تحسين الأداء (lazy loading, splitting).
- تحسين الأنيميشن.
- مراجعة RTL.
- Empty/Error/Loading states في كل مكان.
- مراجعة الصلاحيات في كل شاشة.

**PWA:**
- Service Worker محسّن (cache strategies).
- Manifest كامل + أيقونات (192/512/maskable).
- اختبار التثبيت على iOS/Android.
- شاشة splash.
- شاشة "لا يوجد اتصال".

**Testing:**
- E2E رئيسية: login, add debt, payment, purchase, expense, sale, report.
- اختبارات unit للحسابات المالية.
- اختبارات صلاحيات (Forbidden).

**Deployment:**
- إنشاء Railway project.
- ربط PostgreSQL.
- ربط Backend service (apps/api).
- ربط Frontend service (apps/web).
- متغيرات بيئة.
- Migrations في deploy hook.
- Seed مرة واحدة.
- Custom domain (إن لزم).
- مراقبة logs.

**Deliverable:** نظام في الإنتاج، آمن، سريع، جاهز للاستخدام الفعلي.

---

## معايير قبول كل مرحلة

قبل الانتقال للمرحلة التالية، يجب:
1. ✅ كل APIs محمية بصلاحيات.
2. ✅ كل العمليات المالية داخل transactions.
3. ✅ Audit logs مكتوب.
4. ✅ لا حذف نهائي للمالي.
5. ✅ الفرونت يحترم الصلاحيات.
6. ✅ اختبار يدوي ناجح للسيناريوهات الأساسية.
7. ✅ الكود مراجَع، lint نظيف.

## المخاطر الشائعة وتفاديها

| المخاطر | التفادي |
|---|---|
| تحديث رصيد من الفرونت | لا يوجد endpoint مباشر للأرصدة. |
| نسيان transaction | code review + helper `withTransaction()`. |
| نسيان audit | AuditInterceptor + reviews. |
| نسيان فحص صلاحية | `@Permissions()` decorator إلزامي + lint rule. |
| race conditions على الأرصدة | استخدم `SELECT ... FOR UPDATE` داخل transaction. |
| تقارير بطيئة | indexes + pagination + caching. |
