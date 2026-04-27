# 06 - الموديولات

> هذا الملف يلخّص كل موديول في الباكند والفرونت اند، مسؤولياته، علاقاته، وصلاحياته الرئيسية.

## قائمة الموديولات

```text
auth, users, roles, permissions,
customers, customer-transactions,
sales, daily-income,
suppliers, supplier-transactions, purchases,
expenses, products, inventory,
notifications, reports, audit-logs, settings.
```

كل موديول في الباكند يتكون من:
```text
*.module.ts
*.controller.ts
*.service.ts
dto/
guards/
interceptors/
*.spec.ts
```

---

## 1. auth

**المسؤولية:** تسجيل الدخول، JWT، Refresh tokens، تسجيل الخروج، إعادة تعيين كلمة المرور (للأدمن).

**العمليات:**
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me (يرجع المستخدم + الصلاحيات)

**Audit:** login_success, login_failed, logout, token_refresh.

---

## 2. users

**المسؤولية:** CRUD على المستخدمين، تفعيل/تعطيل، إعادة كلمة مرور، تعيين أدوار.

**العلاقات:** user_roles, audit_logs.

**صلاحيات:** users.* (انظر 04-rbac).

---

## 3. roles

**المسؤولية:** إنشاء/تعديل/حذف/نسخ/تعطيل أدوار، تخصيص صلاحيات.

**ملاحظات:**
- `is_system_role = true` → لا تُحذف.
- تغيير صلاحيات الدور → يُسجل في audit + يفعّل refresh للمستخدمين.

---

## 4. permissions

**المسؤولية:** قراءة فقط من الفرونت. الجدول يُملأ من seed.

**Endpoints:** GET /permissions (مجموعة حسب module).

---

## 5. customers

**المسؤولية:** إدارة العملاء، سقف الدين، الحالة (نشط/مجمد/مهلة)، كشف الحساب.

**العمليات:**
- CRUD مع soft delete + restore.
- تجميد / فك تجميد / منح مهلة / رفع سقف الدين / تصفير حساب.
- طباعة كشف حساب.

**علاقات:** customer_transactions, customer_reminder_settings, customer_behavior_alerts, sales.

---

## 6. customer-transactions

**المسؤولية:** كل حركات ديون العملاء (debt / payment / adjustment / clearance).

**قواعد:**
- كل حركة داخل `prisma.$transaction`.
- تحدّث `customers.current_balance`.
- تتحقق من سقف الدين عند `debt`.
- تتطلب موافقة عند تجاوز السقف أو مبالغ كبيرة.
- لا حذف نهائي: `cancel` فقط مع سبب.
- audit_log لكل عملية.

**Endpoints رئيسية:**
- POST /customer-transactions/debt
- POST /customer-transactions/payment
- POST /customer-transactions/adjustment
- POST /customer-transactions/:id/cancel
- GET /customer-transactions?customer_id=...

---

## 7. sales

**المسؤولية:** البيع بـ 3 أوضاع (تفصيلي / سريع / دخل يومي يُتعامل في daily-income).

**أوضاع:**
- `detailed`: مع sale_items.
- `quick_amount`: مبلغ + نص حر.

**قواعد:**
- البيع الآجل ينشئ customer_transaction نوع `debt`.
- إذا المخزون مفعل والبيع تفصيلي → ينقص المخزون عبر stock_movements.
- ربح = total_price - total_cost (إن أمكن).
- إلغاء البيع: يلغي الـ debt المرتبط ويعكس المخزون.

---

## 8. daily-income

**المسؤولية:** إدخال الدخل اليومي الإجمالي (1 سجل لكل يوم لكل store).

**حقول:** amount, target_amount, manual_cogs_amount, notes.

**قواعد:**
- unique(store_id, income_date).
- إذا profit_calculation_mode = manual_cogs → يستخدم manual_cogs_amount لحساب الربح.

---

## 9. suppliers

**المسؤولية:** إدارة التجار، رصيد افتتاحي، كشف حساب.

**حقول:** name, phone, address, current_balance.

**علاقات:** supplier_transactions, purchases, expenses (supplier_payment).

---

## 10. supplier-transactions

**المسؤولية:** حركات التجار (credit_purchase / payment / adjustment).

**قواعد:**
- شراء آجل → يرفع الرصيد.
- دفع لتاجر → يخفض الرصيد.
- داخل transaction.
- audit + soft cancel.

---

## 11. purchases

**المسؤولية:** المشتريات بـ 2 وضع (total_only / detailed_items) و 2 دفع (cash / credit).

**قواعد:**
- credit → ينشئ supplier_transaction نوع credit_purchase.
- cash → ينشئ expense نوع cash_purchase (اختياري) ولا يلمس رصيد التاجر.
- إذا detailed + المخزون مفعل → ترفع كميات المنتجات عبر stock_movements.
- soft cancel + audit.

---

## 12. expenses

**المسؤولية:** المصاريف.

**أنواع:** normal / supplier_payment / cash_purchase / other.

**قواعد:**
- supplier_payment → يلزم supplier_id + ينشئ supplier_transaction نوع payment.
- normal → مصروف تشغيلي يدخل في الربح والخسارة.
- supplier_payment → **لا** يدخل في الربح والخسارة (سداد التزام).

**فرعي:** expense_categories.

---

## 13. products

**المسؤولية:** إدارة المنتجات.

**حقول:** name, barcode, unit, purchase_price, sale_price, current_quantity, min_quantity, track_inventory, status.

**قواعد:**
- `current_quantity` لا يُعدّل من الواجهة، فقط عبر stock_movements.
- `track_inventory` على مستوى المنتج (يطغى عليه `inventory_enabled` العام).

---

## 14. inventory

**المسؤولية:** المخزون وحركاته.

**Endpoints:** GET /inventory, POST /inventory/movements (in/out/adjust), POST /inventory/movements/:id/cancel.

**قواعد:**
- إذا `inventory_enabled = false` → الموديول يعمل لكن المنتجات لا تتأثر تلقائياً بالبيع.
- كل حركة داخل transaction + audit.

---

## 15. notifications

**المسؤولية:** إنشاء وعرض إشعارات داخل التطبيق + إدارة قوالب واتساب.

**أنواع:** انظر 03-database-design / notifications.type.

**Endpoints:**
- GET /notifications (own / all حسب الصلاحية).
- POST /notifications/:id/read.
- GET /notifications/templates.
- POST /notifications/templates (manage_templates).
- POST /notifications/whatsapp/log (يسجل أن واتساب فُتح).

---

## 16. reports

**المسؤولية:** كل التقارير (انظر 08-reports.md).

**فرعيات:**
- daily / weekly / monthly summaries.
- profit_loss (3 أوضاع: accurate / estimated / manual_cogs).
- cash_flow.
- customer / supplier / sales / purchases / expenses / inventory / user_activity / audit / behavior.

**صلاحيات:** view / print / export منفصلة لكل تقرير.

---

## 17. audit-logs

**المسؤولية:** عرض سجل الحركات. القراءة فقط.

**Endpoints:** GET /audit-logs?filters... (تتطلب audit_logs.view).

---

## 18. settings

**المسؤولية:** إعدادات المتجر (انظر 03-database-design / settings).

**Endpoints:**
- GET /settings.
- PATCH /settings (system.settings.update).
- PATCH /settings/sales-mode (system.sales_mode.update).
- PATCH /settings/currency (system.currency.update).

---

## موديولات الفرونت اند (مرآة)

نفس قائمة الموديولات تنعكس كـ features في `apps/web/src/features/`، ولكل feature:
- `pages/` صفحات.
- `components/` مكونات خاصة.
- `hooks/` (react-query queries/mutations).
- `api/` (axios calls).
- `types/`.
