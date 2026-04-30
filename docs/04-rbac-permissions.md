# 04 - نظام الأدوار والصلاحيات (RBAC)

## 1. الفلسفة

نظام **RBAC ديناميكي**: الصلاحيات ثابتة (codes معرّفة في النظام)، لكن **الأدوار وتوزيع الصلاحيات عليها مرنة بالكامل**. الأدمن يستطيع إنشاء أي دور وتخصيص صلاحياته من واجهة المستخدم.

> **قاعدة ذهبية:** إخفاء الزر من الواجهة ليس حماية. الباكند يجب أن يتحقق من الصلاحية في كل API.

## 2. الجداول الخمسة الأساسية

```text
users
roles
permissions          ← مرجعي، يُملأ من seed فقط
role_permissions     ← (role_id, permission_id, enabled, constraints_json)
user_roles           ← (user_id, role_id, assigned_by, assigned_at)
```

## 3. آلية التحقق من الصلاحية

```text
1. JwtAuthGuard يستخرج user من JWT.
2. PermissionGuard يقرأ @Permissions('customers.create') من الـ decorator.
3. يجلب صلاحيات user من DB أو cache:
     SELECT p.code FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.is_active = true
     JOIN role_permissions rp ON rp.role_id = r.id AND rp.enabled = true
     JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = :userId AND u.is_active = true
4. إذا الصلاحية موجودة → السماح.
5. إذا غير موجودة → 403 + audit_log: permission_denied_attempt + notification للمدير عند الحاجة.
6. (اختياري) constraints_json يُفحص إضافياً (مثل max_amount_without_approval).
```

## 4. قائمة الصلاحيات الكاملة

> الصيغة: `module.action` أو `module.entity.action`.

> **📊 ملاحظة (Phase 2 / P2-2 → P2-6):** المصدر الرسمي للصلاحيات هو ملف `packages/shared/src/constants/permissions.ts`. عند إجراء `pnpm db:seed` يُنشئ النظام **181 صلاحية موزّعة على 19 وحدة (modules)** — هذا هو "Single Source of Truth" المُعتمد في الكود وفي اختبارات Phase 2.
>
> الوحدات الـ 19 هي (بالترتيب الأبجدي): `audit_logs` (4) — `customer_transactions` (10) — `customers` (14) — `daily_income` (6) — `expense_categories` (1) — `expenses` (9) — `inventory` (3) — `notifications` (10) — `permissions` (1) — `products` (9) — `purchases` (11) — `reports` (41) — `roles` (7) — `sales` (13) — `stock_movements` (6) — `supplier_transactions` (8) — `suppliers` (9) — `system` (10) — `users` (9). المجموع = **181**.
>
> الفروقات بين هذا الجدول النصّي والكود:
> 1. **`inventory`** يعرض بشكل مستقل في `permissions.ts` (3 صلاحيات: `inventory.toggle`, `inventory.movements.view`, `inventory.adjustment.create`) لكنه مُدمج هنا في §4.12 "المنتجات والمخزون" لأغراض القراءة.
> 2. **`permissions`** module يحتوي على صلاحية واحدة فقط (`permissions.view` — قراءة كتالوج الصلاحيات للأدوار) ولا يملك قسمًا مستقلًا في هذا الجدول؛ الـ 19 وحدة الفعلية تُعرض في **Permissions Editor** على الواجهة (P2-6) وفي ناتج `GET /api/v1/permissions` (مجموعة بحقل `module`).
> 3. تطبيق **Permissions Editor** على الواجهة (`apps/web/src/components/permissions/PermissionsEditor.tsx`) يقرأ المجموعات ديناميكيًا من الـ API، فيكفي إضافة صلاحية جديدة في `permissions.ts` لتظهر تلقائيًا في الواجهة بعد re-seed.

### 4.1 النظام والإعدادات
```
system.dashboard.view
system.settings.view
system.settings.update
system.currency.update
system.sales_mode.update
system.notifications_settings.update
system.backup.view
system.backup.create
system.backup.restore
system.app_logs.view
```

### 4.2 المستخدمون
```
users.view
users.create
users.update
users.deactivate
users.activate
users.reset_password
users.assign_roles
users.view_activity
users.delete
```

### 4.3 الأدوار والصلاحيات
```
roles.view
roles.create
roles.update
roles.delete
roles.assign_permissions
roles.clone
roles.view_permissions
permissions.view
```

### 4.4 العملاء
```
customers.view
customers.create
customers.update
customers.delete
customers.restore
customers.view_balance
customers.view_transactions
customers.set_credit_limit
customers.freeze
customers.unfreeze
customers.grant_grace
customers.clear_account
customers.export
customers.print_statement
```

### 4.5 حركات ديون العملاء
```
customer_transactions.view
customer_transactions.create_debt
customer_transactions.create_payment
customer_transactions.create_adjustment
customer_transactions.update
customer_transactions.cancel
customer_transactions.delete
customer_transactions.approve_over_limit
customer_transactions.approve_large_amount
customer_transactions.print_receipt
```

### 4.6 البيع
```
sales.view
sales.create
sales.create_detailed
sales.create_quick
sales.create_cash
sales.create_credit
sales.update
sales.cancel
sales.refund
sales.apply_discount
sales.print_receipt
sales.view_profit
sales.close_day
```

### 4.7 الدخل اليومي
```
daily_income.view
daily_income.create
daily_income.update
daily_income.delete
daily_income.approve
daily_income.print
```

### 4.8 المصاريف
```
expenses.view
expenses.create
expenses.create_normal
expenses.create_supplier_payment
expenses.update
expenses.cancel
expenses.delete
expenses.approve
expenses.print
expense_categories.manage
```

### 4.9 التجار
```
suppliers.view
suppliers.create
suppliers.update
suppliers.delete
suppliers.restore
suppliers.view_balance
suppliers.view_transactions
suppliers.set_opening_balance
suppliers.print_statement
```

### 4.10 حركات التجار
```
supplier_transactions.view
supplier_transactions.create_credit_purchase
supplier_transactions.create_payment
supplier_transactions.create_adjustment
supplier_transactions.update
supplier_transactions.cancel
supplier_transactions.delete
supplier_transactions.print_receipt
```

### 4.11 المشتريات
```
purchases.view
purchases.create
purchases.create_cash
purchases.create_credit
purchases.create_with_items
purchases.create_total_only
purchases.update
purchases.cancel
purchases.delete
purchases.print_invoice
purchases.approve
```

### 4.12 المنتجات والمخزون
```
products.view
products.create
products.update
products.delete
products.archive
products.activate
products.pause
products.manage_prices
products.manage_cost
inventory.view
inventory.enable
inventory.disable
stock_movements.view
stock_movements.create_in
stock_movements.create_out
stock_movements.adjust
stock_movements.cancel
stock_movements.print
```

### 4.13 التقارير - عرض
```
reports.dashboard.view
reports.daily_summary.view
reports.weekly_summary.view
reports.monthly_summary.view
reports.profit_loss.view
reports.cash_flow.view
reports.sales.view
reports.customer_debts.view
reports.customer_statement.view
reports.supplier_debts.view
reports.supplier_statement.view
reports.purchases.view
reports.expenses.view
reports.inventory.view
reports.user_activity.view
reports.audit.view
reports.behavior_analysis.view
```

### 4.14 التقارير - طباعة
```
reports.print.daily_summary
reports.print.monthly_summary
reports.print.profit_loss
reports.print.cash_flow
reports.print.customer_debts
reports.print.customer_statement
reports.print.supplier_debts
reports.print.supplier_statement
reports.print.purchases
reports.print.expenses
reports.print.inventory
reports.print.user_activity
```

### 4.15 التقارير - تصدير
```
reports.export.daily_summary
reports.export.monthly_summary
reports.export.profit_loss
reports.export.cash_flow
reports.export.customer_debts
reports.export.customer_statement
reports.export.supplier_debts
reports.export.supplier_statement
reports.export.purchases
reports.export.expenses
reports.export.inventory
reports.export.user_activity
```

### 4.16 الإشعارات
```
notifications.view_own
notifications.view_all
notifications.create
notifications.mark_read
notifications.manage_settings
notifications.manage_templates
notifications.send_internal
notifications.send_whatsapp
notifications.schedule_customer_reminders
notifications.cancel_scheduled
```

### 4.17 سجل الحركات
```
audit_logs.view
audit_logs.view_sensitive
audit_logs.print
audit_logs.export
```

## 5. الأدوار الافتراضية (Seed)

تُنشأ مع `prisma seed`، وتكون `is_system_role = true` (لا تُحذف).

### 5.1 Owner (المالك)
- جميع الصلاحيات (`*`).

### 5.2 Manager (المدير)
معظم الصلاحيات ما عدا:
- `system.backup.restore`
- `users.delete`
- `roles.delete` (له fix باستثناء أدوار النظام)

### 5.3 Sales Worker (عامل مبيعات)
```
customers.view
customers.create
customer_transactions.view
customer_transactions.create_debt
customer_transactions.create_payment
customer_transactions.print_receipt
sales.view
sales.create
sales.create_quick
sales.create_credit
sales.create_cash
sales.print_receipt
daily_income.create
notifications.view_own
```

لا يرى: الأرباح، التقارير المالية، سجل الحركات، إدارة الأدوار، حذف العمليات.

### 5.4 Accountant (محاسب)
```
customers.view
customers.view_balance
customers.view_transactions
suppliers.view
suppliers.view_balance
suppliers.view_transactions
expenses.view
expenses.create
expenses.create_normal
daily_income.view
reports.dashboard.view
reports.daily_summary.view
reports.monthly_summary.view
reports.profit_loss.view
reports.cash_flow.view
reports.print.monthly_summary
reports.print.profit_loss
reports.export.monthly_summary
audit_logs.view
notifications.view_own
```

### 5.5 Purchasing Officer (مسؤول مشتريات)
```
suppliers.view
suppliers.create
suppliers.update
suppliers.view_balance
suppliers.view_transactions
supplier_transactions.view
supplier_transactions.create_credit_purchase
supplier_transactions.create_payment
purchases.view
purchases.create
purchases.create_cash
purchases.create_credit
purchases.create_with_items
purchases.create_total_only
purchases.print_invoice
products.view
products.create
stock_movements.create_in
notifications.view_own
```

### 5.6 Inventory Officer (مسؤول مخزون)
```
products.view
products.create
products.update
products.pause
products.activate
products.manage_prices
inventory.view
stock_movements.view
stock_movements.create_in
stock_movements.create_out
stock_movements.adjust
reports.inventory.view
reports.print.inventory
notifications.view_own
```

## 6. constraints_json

يُستخدم لقيود إضافية على الصلاحية:

```json
{
  "max_amount_without_approval": 50000,
  "scope": "own",
  "allowed_payment_types": ["cash"],
  "max_discount_percentage": 10
}
```

أمثلة استخدام:
- `customer_transactions.create_debt` بقيد `max_amount_without_approval = 50000` → فوق هذا المبلغ تطلب موافقة المدير.
- `sales.apply_discount` بقيد `max_discount_percentage = 10`.
- `audit_logs.view` بقيد `scope = "own"` → يرى فقط حركاته.

## 7. سلوك الواجهة

```text
- إذا المستخدم لا يملك صلاحية حذف عميل → زر الحذف لا يظهر.
- إذا لا يملك صلاحية عرض الأرباح → عمود الربح يختفي.
- إذا لا يملك صلاحية طباعة → زر الطباعة لا يظهر.
- إذا لا يملك تعديل سقف الدين → الحقل للقراءة فقط أو يختفي.
- إذا لا يملك view → القائمة لا تظهر في القائمة الجانبية.
```

> الواجهة فقط تُحسّن تجربة المستخدم. الباكند هو الحماية الفعلية.

## 8. تخزين/كاش الصلاحيات

- الباكند يجلب صلاحيات المستخدم عند تسجيل الدخول ويخزنها في **الـ JWT claims** أو **Redis cache** (اختياري لاحقاً).
- في v1: استعلام عند كل طلب كافٍ، مع index على user_roles + role_permissions.
- الفرونت يستلم قائمة `permissions: string[]` مع بيانات المستخدم بعد الدخول.
- عند تغيير صلاحيات الدور، يجب إجبار تحديث session (logout أو refresh).

## 9. واجهات إدارة الأدوار

شاشات مطلوبة في الفرونت:
1. قائمة الأدوار (إنشاء/تعديل/حذف/نسخ/تعطيل).
2. شاشة تحرير دور: شجرة شيك بوكسات حسب الموديولات.
3. تعيين دور لمستخدم.
4. عرض المستخدمين الذين يحملون الدور.
5. سجل التغييرات على الدور.

## 10. أحداث RBAC في audit_logs

كل ما يلي يجب تسجيله:
- `role.created`, `role.updated`, `role.deleted`, `role.cloned`
- `role.permissions_changed` (مع old/new permissions list)
- `user.role_assigned`, `user.role_removed`
- `user.deactivated`, `user.activated`
- `user.password_reset`
- `permission_denied_attempt` (محاولة وصول مرفوضة)
