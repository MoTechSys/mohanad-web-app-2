# 07 - خطة API Endpoints

> كل endpoint محمي بـ JwtAuthGuard + PermissionGuard. الصلاحيات المطلوبة موضحة في كل سطر.
> الجميع يعيد JSON. الأخطاء الموحدة: 400, 401, 403, 404, 409, 422, 500.

## 1. Auth

| Method | Path | Permission | الوصف |
|---|---|---|---|
| POST | /auth/login | عام | يرجع access + refresh tokens + user + permissions |
| POST | /auth/refresh | عام (refresh token) | يرجع access جديد |
| POST | /auth/logout | مصادق | إبطال refresh token |
| GET  | /auth/me | مصادق | بيانات المستخدم + الصلاحيات |
| POST | /auth/change-password | مصادق | تغيير كلمة مروره بنفسه |

## 2. Users

| Method | Path | Permission |
|---|---|---|
| GET    | /users | users.view |
| GET    | /users/:id | users.view |
| POST   | /users | users.create |
| PATCH  | /users/:id | users.update |
| POST   | /users/:id/deactivate | users.deactivate |
| POST   | /users/:id/activate | users.activate |
| POST   | /users/:id/reset-password | users.reset_password |
| POST   | /users/:id/roles | users.assign_roles |
| GET    | /users/:id/activity | users.view_activity |
| DELETE | /users/:id | users.delete (soft) |

## 3. Roles

| Method | Path | Permission |
|---|---|---|
| GET    | /roles | roles.view |
| GET    | /roles/:id | roles.view_permissions |
| POST   | /roles | roles.create |
| PATCH  | /roles/:id | roles.update |
| DELETE | /roles/:id | roles.delete |
| POST   | /roles/:id/clone | roles.clone |
| PUT    | /roles/:id/permissions | roles.assign_permissions |

## 4. Permissions

| Method | Path | Permission |
|---|---|---|
| GET | /permissions | permissions.view |
| GET | /permissions/grouped | permissions.view |

## 5. Customers

| Method | Path | Permission |
|---|---|---|
| GET    | /customers | customers.view |
| GET    | /customers/:id | customers.view |
| POST   | /customers | customers.create |
| PATCH  | /customers/:id | customers.update |
| DELETE | /customers/:id | customers.delete (soft) |
| POST   | /customers/:id/restore | customers.restore |
| GET    | /customers/:id/balance | customers.view_balance |
| GET    | /customers/:id/transactions | customers.view_transactions |
| PATCH  | /customers/:id/credit-limit | customers.set_credit_limit |
| POST   | /customers/:id/freeze | customers.freeze |
| POST   | /customers/:id/unfreeze | customers.unfreeze |
| POST   | /customers/:id/grace | customers.grant_grace |
| POST   | /customers/:id/clear | customers.clear_account |
| GET    | /customers/:id/statement | customers.print_statement |
| GET    | /customers/export | customers.export |

## 6. Customer Transactions

| Method | Path | Permission |
|---|---|---|
| GET    | /customer-transactions | customer_transactions.view |
| GET    | /customer-transactions/:id | customer_transactions.view |
| POST   | /customer-transactions/debt | customer_transactions.create_debt |
| POST   | /customer-transactions/payment | customer_transactions.create_payment |
| POST   | /customer-transactions/adjustment | customer_transactions.create_adjustment |
| PATCH  | /customer-transactions/:id | customer_transactions.update |
| POST   | /customer-transactions/:id/cancel | customer_transactions.cancel |
| GET    | /customer-transactions/:id/receipt | customer_transactions.print_receipt |

> ملاحظات: تجاوز السقف يحتاج `customer_transactions.approve_over_limit` ضمن نفس الطلب أو طلب موافقة منفصل.

## 7. Sales

| Method | Path | Permission |
|---|---|---|
| GET    | /sales | sales.view |
| GET    | /sales/:id | sales.view |
| POST   | /sales | sales.create |
| POST   | /sales/detailed | sales.create_detailed |
| POST   | /sales/quick | sales.create_quick |
| PATCH  | /sales/:id | sales.update |
| POST   | /sales/:id/cancel | sales.cancel |
| POST   | /sales/:id/refund | sales.refund |
| POST   | /sales/:id/discount | sales.apply_discount |
| GET    | /sales/:id/receipt | sales.print_receipt |
| GET    | /sales/profit | sales.view_profit |
| POST   | /sales/close-day | sales.close_day |

## 8. Daily Income

| Method | Path | Permission |
|---|---|---|
| GET    | /daily-income | daily_income.view |
| GET    | /daily-income/:date | daily_income.view |
| POST   | /daily-income | daily_income.create |
| PATCH  | /daily-income/:id | daily_income.update |
| DELETE | /daily-income/:id | daily_income.delete (soft) |
| POST   | /daily-income/:id/approve | daily_income.approve |
| GET    | /daily-income/:id/print | daily_income.print |

## 9. Suppliers

| Method | Path | Permission |
|---|---|---|
| GET    | /suppliers | suppliers.view |
| GET    | /suppliers/:id | suppliers.view |
| POST   | /suppliers | suppliers.create |
| PATCH  | /suppliers/:id | suppliers.update |
| DELETE | /suppliers/:id | suppliers.delete (soft) |
| POST   | /suppliers/:id/restore | suppliers.restore |
| GET    | /suppliers/:id/balance | suppliers.view_balance |
| GET    | /suppliers/:id/transactions | suppliers.view_transactions |
| PATCH  | /suppliers/:id/opening-balance | suppliers.set_opening_balance |
| GET    | /suppliers/:id/statement | suppliers.print_statement |

## 10. Supplier Transactions

| Method | Path | Permission |
|---|---|---|
| GET    | /supplier-transactions | supplier_transactions.view |
| POST   | /supplier-transactions/credit-purchase | supplier_transactions.create_credit_purchase |
| POST   | /supplier-transactions/payment | supplier_transactions.create_payment |
| POST   | /supplier-transactions/adjustment | supplier_transactions.create_adjustment |
| POST   | /supplier-transactions/:id/cancel | supplier_transactions.cancel |
| GET    | /supplier-transactions/:id/receipt | supplier_transactions.print_receipt |

## 11. Purchases

| Method | Path | Permission |
|---|---|---|
| GET    | /purchases | purchases.view |
| GET    | /purchases/:id | purchases.view |
| POST   | /purchases | purchases.create |
| POST   | /purchases/total-only | purchases.create_total_only |
| POST   | /purchases/detailed | purchases.create_with_items |
| PATCH  | /purchases/:id | purchases.update |
| POST   | /purchases/:id/cancel | purchases.cancel |
| POST   | /purchases/:id/approve | purchases.approve |
| GET    | /purchases/:id/invoice | purchases.print_invoice |

## 12. Expenses

| Method | Path | Permission |
|---|---|---|
| GET    | /expenses | expenses.view |
| GET    | /expenses/:id | expenses.view |
| POST   | /expenses/normal | expenses.create_normal |
| POST   | /expenses/supplier-payment | expenses.create_supplier_payment |
| PATCH  | /expenses/:id | expenses.update |
| POST   | /expenses/:id/cancel | expenses.cancel |
| POST   | /expenses/:id/approve | expenses.approve |
| GET    | /expenses/:id/print | expenses.print |
| GET    | /expense-categories | expenses.view |
| POST   | /expense-categories | expense_categories.manage |
| PATCH  | /expense-categories/:id | expense_categories.manage |

## 13. Products

| Method | Path | Permission |
|---|---|---|
| GET    | /products | products.view |
| GET    | /products/:id | products.view |
| POST   | /products | products.create |
| PATCH  | /products/:id | products.update |
| POST   | /products/:id/pause | products.pause |
| POST   | /products/:id/activate | products.activate |
| POST   | /products/:id/archive | products.archive |
| PATCH  | /products/:id/prices | products.manage_prices |
| PATCH  | /products/:id/cost | products.manage_cost |

## 14. Inventory / Stock Movements

| Method | Path | Permission |
|---|---|---|
| GET    | /inventory | inventory.view |
| POST   | /inventory/enable | inventory.enable |
| POST   | /inventory/disable | inventory.disable |
| GET    | /stock-movements | stock_movements.view |
| POST   | /stock-movements/in | stock_movements.create_in |
| POST   | /stock-movements/out | stock_movements.create_out |
| POST   | /stock-movements/adjust | stock_movements.adjust |
| POST   | /stock-movements/:id/cancel | stock_movements.cancel |
| GET    | /stock-movements/:id/print | stock_movements.print |

## 15. Notifications

| Method | Path | Permission |
|---|---|---|
| GET    | /notifications | notifications.view_own |
| GET    | /notifications/all | notifications.view_all |
| POST   | /notifications | notifications.create |
| POST   | /notifications/:id/read | notifications.mark_read |
| GET    | /notifications/templates | notifications.manage_templates |
| POST   | /notifications/templates | notifications.manage_templates |
| PATCH  | /notifications/templates/:id | notifications.manage_templates |
| POST   | /notifications/whatsapp/log | notifications.send_whatsapp |
| POST   | /notifications/customer-reminders | notifications.schedule_customer_reminders |
| POST   | /notifications/:id/cancel-scheduled | notifications.cancel_scheduled |
| PATCH  | /notifications/settings | notifications.manage_settings |

## 16. Reports

> صلاحيات منفصلة لـ view / print / export.

| Method | Path | Permission |
|---|---|---|
| GET | /reports/dashboard | reports.dashboard.view |
| GET | /reports/daily-summary | reports.daily_summary.view |
| GET | /reports/weekly-summary | reports.weekly_summary.view |
| GET | /reports/monthly-summary | reports.monthly_summary.view |
| GET | /reports/profit-loss | reports.profit_loss.view |
| GET | /reports/cash-flow | reports.cash_flow.view |
| GET | /reports/sales | reports.sales.view |
| GET | /reports/customer-debts | reports.customer_debts.view |
| GET | /reports/customer-statement/:customerId | reports.customer_statement.view |
| GET | /reports/supplier-debts | reports.supplier_debts.view |
| GET | /reports/supplier-statement/:supplierId | reports.supplier_statement.view |
| GET | /reports/purchases | reports.purchases.view |
| GET | /reports/expenses | reports.expenses.view |
| GET | /reports/inventory | reports.inventory.view |
| GET | /reports/user-activity | reports.user_activity.view |
| GET | /reports/audit | reports.audit.view |
| GET | /reports/behavior-analysis | reports.behavior_analysis.view |

### طباعة التقارير
كل تقرير: `POST /reports/<name>/print` يتطلب `reports.print.<name>`.
يرجع HTML/PDF جاهز للطباعة.

### تصدير التقارير
كل تقرير: `POST /reports/<name>/export?format=xlsx|csv|pdf` يتطلب `reports.export.<name>`.

## 17. Audit Logs

| Method | Path | Permission |
|---|---|---|
| GET    | /audit-logs | audit_logs.view |
| GET    | /audit-logs/sensitive | audit_logs.view_sensitive |
| POST   | /audit-logs/print | audit_logs.print |
| POST   | /audit-logs/export | audit_logs.export |

## 18. Settings

| Method | Path | Permission |
|---|---|---|
| GET    | /settings | system.settings.view |
| PATCH  | /settings | system.settings.update |
| PATCH  | /settings/currency | system.currency.update |
| PATCH  | /settings/sales-mode | system.sales_mode.update |
| PATCH  | /settings/notifications | system.notifications_settings.update |
| GET    | /settings/backup | system.backup.view |
| POST   | /settings/backup/create | system.backup.create |
| POST   | /settings/backup/restore | system.backup.restore |
| GET    | /settings/app-logs | system.app_logs.view |

## 19. Conventions

- **Pagination:** `?page=1&limit=20&sort=created_at:desc`.
- **Filtering:** `?from=YYYY-MM-DD&to=YYYY-MM-DD&status=...&customer_id=...`.
- **Errors:**
```json
{ "statusCode": 403, "code": "PERMISSION_DENIED", "message": "..." }
```
- **DateTime:** ISO 8601, UTC في الباكند، عرض محلي في الفرونت.
- **Money:** decimal as string لتفادي float errors.
- **Idempotency:** عمليات مالية حساسة تقبل header `Idempotency-Key`.
