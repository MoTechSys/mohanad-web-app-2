# 10 - الأمان وسجل الحركات (Security & Audit)

> **القاعدة الذهبية:** نحن نبني نظاماً مالياً. لا حذف نهائي. الباكند هو الحماية الفعلية. كل عملية تُسجَّل.

## 0. القاعدة المحاسبية المعتمدة (مهم جداً)

```text
- شراء آجل  →  purchase + supplier_transaction (دين تاجر +)
- شراء نقدي →  purchase فقط (لا expense منفصل، Cash Flow ينقص النقد)
- دفع لمورد →  expense(type=supplier_payment) + supplier_transaction (دين تاجر -)
- خرج عادي →  expense(type=normal) فقط
```

> **ملاحظة:** الشراء النقدي **لا** يُسجَّل كـ expense منفصل. يظهر في Cash Flow كنقد خارج عبر استعلام JOIN على purchases حيث payment_type=cash.

---

## 1. مبادئ الأمان الأساسية

1. **الباكند هو الحماية الحقيقية**. إخفاء الزر من الواجهة لا يحمي.
2. **كل API محمي بـ JwtAuthGuard + PermissionGuard**.
3. **كل العمليات المالية تتم داخل `prisma.$transaction`**.
4. **لا تحديث للأرصدة من الواجهة**. الفرونت يرسل الطلب، الباكند يحسب ويحدّث.
5. **لا حذف نهائي للعمليات المالية**. Soft delete + Cancel فقط.
6. **كل تعديل/إلغاء/إنشاء حساس يُسجَّل في audit_logs**.
7. **كلمات المرور**: bcrypt (12 rounds).
8. **الأسرار**: متغيرات بيئة، لا تظهر في logs.

## 2. منع الحذف النهائي

### آلية Cancel
لكل جدول مالي:
```text
cancelled_at  timestamp nullable
cancelled_by  FK users  nullable
cancel_reason text      nullable
```

عند طلب الإلغاء:
1. التحقق من الصلاحية (مثل `customer_transactions.cancel`).
2. التحقق من أن السجل غير ملغى مسبقاً.
3. عكس الأثر المالي (مثلاً: إعادة الرصيد للحالة قبل العملية).
4. تسجيل audit_log.
5. كل ذلك داخل transaction.

### آلية Soft Delete
لجداول الكيانات (customers, suppliers, products, users):
```text
deleted_at   timestamp nullable
deleted_by   FK users  nullable
delete_reason text     nullable (اختياري)
```

عند طلب الحذف:
1. التحقق من الصلاحية.
2. التأكد من عدم وجود ارتباطات نشطة (مثلاً: عميل عليه دين لا يُحذف).
3. وضع `deleted_at`.
4. audit_log.

### Restore
endpoint منفصل بصلاحية `*.restore` يعيد `deleted_at = null`.

## 3. حماية الأرصدة

```text
- customers.current_balance     لا يُحدَّث إلا داخل customer-transactions transaction.
- suppliers.current_balance     لا يُحدَّث إلا داخل supplier-transactions transaction.
- products.current_quantity     لا يُحدَّث إلا داخل stock-movements transaction.
```

> الفرونت **لا يملك** endpoint للتحديث المباشر للأرصدة أو الكميات. أي تغيير يأتي عبر transaction.

## 4. Database Transactions

كل العمليات التالية إلزامية داخل `prisma.$transaction`:

```text
- إضافة دين عميل
- تسجيل سداد عميل
- تسوية حساب عميل
- إنشاء بيع (تفصيلي/سريع)
- إلغاء بيع (يعكس debt + stock)
- إنشاء شراء
- إلغاء شراء
- دفع لتاجر
- إضافة مصروف
- إلغاء مصروف
- حركة مخزون (in/out/adjust)
- إلغاء حركة مخزون
- إنشاء/تعديل دور بصلاحياته
- تعيين/إزالة دور لمستخدم
```

نموذج كود:
```ts
return await this.prisma.$transaction(async (tx) => {
  const customer = await tx.customer.findUnique({ where: { id } });
  if (!customer) throw new NotFoundException();

  const newBalance = customer.current_balance.plus(amount);

  // قاعدة سقف الدين
  if (newBalance.gt(customer.credit_limit) && !user.permissions.includes('customer_transactions.approve_over_limit')) {
    throw new ForbiddenException('OVER_CREDIT_LIMIT_REQUIRES_APPROVAL');
  }

  const trx = await tx.customerTransaction.create({
    data: {
      type: 'debt',
      amount,
      balance_before: customer.current_balance,
      balance_after: newBalance,
      // ...
    }
  });

  await tx.customer.update({
    where: { id },
    data: { current_balance: newBalance },
  });

  await tx.auditLog.create({
    data: {
      user_id: user.id,
      action: 'customer_transaction.create_debt',
      entity_type: 'customer_transaction',
      entity_id: trx.id,
      old_values: { balance: customer.current_balance },
      new_values: { balance: newBalance, amount },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    }
  });

  if (newBalance.gt(customer.credit_limit)) {
    await tx.notification.create({ /* customer_credit_limit */ });
  }

  return trx;
});
```

## 5. التحقق من الصلاحيات في كل endpoint

كل controller route:
```ts
@Post('debt')
@Permissions('customer_transactions.create_debt')
@UseGuards(JwtAuthGuard, PermissionGuard)
async addDebt(@Body() dto: AddDebtDto, @CurrentUser() user: User) {
  return this.svc.addDebt(dto, user);
}
```

`PermissionGuard`:
1. يقرأ `@Permissions(...)`.
2. يجلب صلاحيات user (من JWT أو DB).
3. إذا ناقصة → 403.
4. يكتب audit_log: `permission_denied_attempt` + ينشئ notification إن لزم.

## 6. سجل الحركات (audit_logs)

### الأحداث التي تُسجَّل
```text
auth.login_success
auth.login_failed
auth.logout
auth.token_refresh
auth.password_changed
user.created / updated / deactivated / activated / role_assigned / role_removed / password_reset
role.created / updated / deleted / cloned / permissions_changed
customer.created / updated / deleted / restored / freeze / unfreeze / grace / clear_account / credit_limit_changed
customer_transaction.create_debt / create_payment / create_adjustment / cancel
sale.created / cancelled / refunded / discount_applied
daily_income.created / updated / deleted / approved
supplier.created / updated / deleted / restored
supplier_transaction.create_credit_purchase / create_payment / cancel
purchase.created / cancelled / approved
expense.created / cancelled / approved
product.created / updated / paused / activated / archived / prices_changed
stock_movement.in / out / adjust / cancel
inventory.enabled / disabled
notification.created / template_changed / settings_changed / whatsapp_opened
settings.updated / currency_changed / sales_mode_changed
permission_denied_attempt
```

### حقول السجل
```text
id, store_id, user_id (nullable),
action, entity_type, entity_id,
old_values JSON, new_values JSON,
ip_address, user_agent,
created_at
```

> `old_values` و `new_values` يحويان فرق التغيير فقط (diff).

### من يقرأ السجل
- `audit_logs.view` → السجلات العامة.
- `audit_logs.view_sensitive` → السجلات الحساسة (تغيير صلاحيات، حذف، تجاوز سقف).
- `audit_logs.print` / `audit_logs.export` → الطباعة والتصدير.

### لا يُحذف السجل
جدول `audit_logs` **لا يُحذف منه أبداً** بأي عملية مستخدم. فقط أرشفة دورية مستقبلية إن لزم.

## 7. JWT Strategy

```text
Access Token  : short-lived (15 minutes)
Refresh Token : long-lived (7 days), stored hashed in refresh_tokens table
```

- Access في الذاكرة (في الفرونت)، أو cookie httpOnly.
- Refresh في cookie httpOnly + Secure + SameSite=Strict.
- Logout يبطل refresh token (revoked_at).
- Refresh مرة واحدة (rotation) - كل refresh ينشئ جديد ويبطل القديم.

JWT payload:
```json
{
  "sub": "user-uuid",
  "store_id": "store-uuid",
  "username": "...",
  "permissions": ["customers.view", "..."],
  "iat": ..., "exp": ...
}
```

## 8. Validation

- كل DTO عليه `class-validator` أو `zod`.
- المبالغ: decimal positive، حد أقصى منطقي.
- النصوص: trim + max length.
- التواريخ: ISO 8601.
- IDs: UUID format.

## 9. Rate Limiting

```text
- /auth/login : 5 محاولات / IP / 15 دقيقة
- General API: 100 طلب / دقيقة / user
```

استخدام `@nestjs/throttler`.

## 10. CORS و Headers

```text
- CORS allowed origins : فقط الفرونت الخاص بنا.
- Helmet: فعّل كل defaults + CSP بسيط.
- HSTS: من Railway.
```

## 11. Logging

- لا تُسجَّل بيانات حساسة (passwords, tokens) في console/file.
- استخدم Pino أو nest-logger.
- مستويات: error/warn/info/debug.
- في الإنتاج: error/warn/info فقط.

## 12. Backups (مستقبلاً)

- Railway يوفر backups تلقائي للـ PostgreSQL.
- في المستقبل: endpoint `/settings/backup/create` بصلاحية خاصة.
- استعادة فقط من قبل المالك بـ `system.backup.restore`.

## 13. Edge Cases مهمة

| الحالة | السلوك |
|---|---|
| user محذوف يحاول الدخول | 401 + audit `auth.login_failed` |
| role معطل وعليه users | الـ users يفقدون صلاحياتهم تلقائياً |
| محاولة إلغاء عملية ملغاة | 409 Conflict |
| محاولة إلغاء عملية قديمة جداً (>30 يوم؟) | يحتاج صلاحية إضافية أو يُمنع |
| استعلام تقرير ضخم | pagination + limit + timeout |
| محاولة بيع آجل لعميل مجمد | 422 + رسالة |
| محاولة سداد أكثر من الرصيد | يسمح (يصبح رصيد سالب = البقالة عليها للعميل) أو يمنع حسب الإعداد |

## 14. خلاصة قائمة الحماية

- [x] HTTPS only
- [x] JWT + Refresh rotation
- [x] bcrypt
- [x] PermissionGuard على كل endpoint
- [x] Validation على كل DTO
- [x] Prisma transactions على كل عملية مالية
- [x] No hard delete
- [x] Soft delete + Cancel + Audit
- [x] Audit logs لا يُحذف
- [x] Rate limiting
- [x] Helmet + CORS
- [x] Logging دون أسرار
- [x] Frontend لا يحدّث الأرصدة
- [x] الصلاحيات على 3 مستويات للتقارير (view/print/export)
