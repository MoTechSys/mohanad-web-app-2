# 03 - تصميم قاعدة البيانات

> **القاعدة:** Railway PostgreSQL. ORM: Prisma. كل الجداول المهمة فيها `store_id` للدعم المستقبلي للمتعدد.

## 1. مجموعات الجداول

```text
Core         : stores, users, roles, permissions, role_permissions, user_roles, refresh_tokens, settings
Customers    : customers, customer_transactions, customer_reminder_settings, customer_behavior_alerts
Sales        : sales, sale_items, daily_incomes
Suppliers    : suppliers, supplier_transactions, purchases, purchase_items
Expenses     : expenses, expense_categories
Products     : products, stock_movements
Notifications: notifications, notification_templates, scheduled_jobs
Audit        : audit_logs, report_snapshots
```

## 2. الجداول الأساسية (Core)

### stores
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | cuid PK | |
| name | string | اسم البقالة |
| owner_name | string | |
| phone | string | |
| address | string | |
| currency | string | مثلاً `YER`, `SAR` |
| opening_cash_balance | decimal(14,2) | الرصيد النقدي الافتتاحي |
| opening_balance_date | date | تاريخ بدء التشغيل |
| large_transaction_threshold | decimal(14,2) | default 50000 |
| is_active | bool | |
| created_at, updated_at, deleted_at | timestamp | |

### users
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| store_id | FK → stores | |
| name | string | |
| phone | string | |
| username | string unique per store | |
| password_hash | string | bcrypt |
| is_active | bool default true | |
| last_login_at | timestamp | |
| created_at, updated_at, deleted_at | timestamp | soft delete |

### roles
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| store_id | FK → stores | |
| name | string | |
| description | text | |
| is_system_role | bool | الأدوار الأساسية لا تُحذف |
| is_active | bool | |
| created_by | FK → users | |
| created_at, updated_at, deleted_at | timestamp | |

### permissions
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| code | string unique | مثل `customers.create` |
| name_ar | string | الاسم العربي |
| description_ar | text | |
| module | string | مثل `customers` |
| action | string | مثل `create` |

> الصلاحيات **مشتركة** عبر النظام كله (لا تتبع store_id).

### role_permissions
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| role_id | FK → roles | |
| permission_id | FK → permissions | |
| enabled | bool default true | |
| constraints_json | JSON nullable | قيود إضافية |

مثال constraints_json:
```json
{ "max_amount_without_approval": 50000, "scope": "own" }
```

### user_roles
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| user_id | FK → users | |
| role_id | FK → roles | |
| assigned_by | FK → users | |
| assigned_at | timestamp | |

### refresh_tokens
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| user_id | FK → users | |
| token_hash | string | |
| expires_at | timestamp | |
| revoked_at | timestamp nullable | |
| user_agent, ip | string | |
| created_at | timestamp | |

### settings
انظر تفاصيل أدناه في القسم settings.

## 3. العملاء

### customers
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| name | string | |
| phone | string | |
| address | string | |
| credit_limit | decimal(14,2) | سقف الدين |
| opening_balance | decimal(14,2) | default 0 — رصيد افتتاحي |
| current_balance | decimal(14,2) | يحدّث من الباكند فقط (مسموح سالب = البقالة عليها للعميل) |
| status | enum: active / frozen / grace | |
| grace_until | date nullable | |
| notes | text | |
| created_by | FK users | |
| created_at, updated_at, deleted_at | timestamp | soft delete |

### customer_transactions
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| customer_id | FK | |
| type | enum: debt / payment / adjustment / clearance | |
| amount | decimal(14,2) | |
| details_text | text | تفاصيل نصية حرة |
| balance_before | decimal | snapshot |
| balance_after | decimal | snapshot |
| transaction_date | timestamp | |
| created_by | FK users | |
| created_at | timestamp | |
| cancelled_at, cancelled_by, cancel_reason | nullable | لا حذف نهائي |

### customer_reminder_settings
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id, customer_id | FK | |
| enabled | bool | |
| frequency_type | enum: days / weekly / monthly | |
| frequency_value | int | |
| next_run_at | timestamp | |
| message_template | text | |
| created_at, updated_at | | |

### customer_behavior_alerts
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id, customer_id | FK | |
| average_amount | decimal | |
| current_amount | decimal | |
| drop_percentage | decimal | |
| alert_date | date | |
| created_at | | |

## 4. المبيعات والدخل اليومي

### sales
| الحقل | النوع | ملاحظات |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| customer_id | FK nullable | للبيع النقدي بدون عميل |
| sale_mode | enum: detailed / quick_amount | (daily_summary منفصل في daily_incomes) |
| payment_type | enum: cash / credit | (mixed مؤجل لـ v2) |
| total_amount | decimal | |
| cost_amount | decimal nullable | إذا متاح |
| profit_amount | decimal nullable | محسوب |
| details_text | text | للبيع السريع |
| sale_date | timestamp | |
| created_by | FK users | |
| created_at | | |
| cancelled_at, cancelled_by, cancel_reason | nullable | |

### sale_items
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| sale_id | FK | |
| product_id | FK nullable | يمكن صنف يدوي بلا منتج |
| name_snapshot | string | snapshot وقت البيع |
| quantity | decimal | |
| unit_price | decimal | |
| unit_cost | decimal | snapshot |
| total_price | decimal | |
| total_cost | decimal | |

### daily_incomes
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| income_date | date unique per store | |
| amount | decimal | |
| target_amount | decimal nullable | |
| manual_cogs_amount | decimal nullable | تكلفة بضاعة يدوية |
| notes | text | |
| created_by | FK users | |
| created_at, updated_at | | |

## 5. التجار والمشتريات

### suppliers
| الحقل | النوع | |
|---|---|---|
| id | cuid PK | |
| store_id | FK | |
| name | string | |
| phone, address | string | |
| opening_balance | decimal(14,2) | default 0 — رصيد افتتاحي |
| current_balance | decimal | دين البقالة على التاجر |
| notes | text | |
| created_by | FK | |
| created_at, updated_at, deleted_at | | soft delete |

### supplier_transactions
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id, supplier_id | FK | |
| type | enum: credit_purchase / payment / adjustment | |
| amount | decimal | |
| balance_before, balance_after | decimal | snapshot |
| details_text | text | |
| transaction_date | timestamp | |
| created_by | FK | |
| cancelled_at, cancelled_by, cancel_reason | | |

### purchases
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| supplier_id | FK nullable | |
| supplier_name_manual | string nullable | لو التاجر غير مسجل |
| purchase_mode | enum: total_only / detailed_items | |
| payment_type | enum: cash / credit | |
| total_amount | decimal | |
| details_text | text | |
| purchase_date | timestamp | |
| created_by | FK | |
| cancelled_at, cancelled_by, cancel_reason | | |

### purchase_items
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| purchase_id | FK | |
| product_id | FK nullable | |
| name_snapshot | string | |
| quantity, unit_cost, total_cost | decimal | |

## 6. المصاريف

### expense_categories
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| name | string | |
| is_active | bool | |
| created_at, updated_at | | |

### expenses
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| type | enum: normal / supplier_payment / cash_purchase / other | |
| category_id | FK nullable | |
| supplier_id | FK nullable | |
| amount | decimal | |
| details_text | text | |
| expense_date | timestamp | |
| created_by | FK | |
| cancelled_at, cancelled_by, cancel_reason | | |

> ملاحظة مهمة: `supplier_payment` لا يحسب مصروف تشغيلي في تقرير الربح والخسارة.

## 7. المنتجات والمخزون

### products
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| name | string | |
| barcode | string nullable | |
| unit | string | كيلو، حبة... |
| purchase_price | decimal | |
| sale_price | decimal | |
| current_quantity | decimal | يحدّث من الباكند |
| min_quantity | decimal | للتنبيه |
| track_inventory | bool default true | |
| status | enum: active / paused / archived | |
| created_by | FK | |
| created_at, updated_at, deleted_at | | |

### stock_movements
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id, product_id | FK | |
| type | enum: in / out / adjust | |
| quantity | decimal | |
| quantity_before, quantity_after | decimal | snapshot |
| reference_type | enum: sale / purchase / manual | |
| reference_id | UUID nullable | |
| details_text | text | |
| movement_date | timestamp | |
| created_by | FK | |
| cancelled_at, cancelled_by, cancel_reason | | |

## 8. الإعدادات

### settings (سجل واحد لكل store)
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK unique | |
| currency | string | |
| sales_mode | enum: detailed / quick / daily / hybrid | |
| inventory_enabled | bool | |
| profit_calculation_mode | enum: accurate_by_sales_items / estimated_by_daily_income / manual_cogs | |
| daily_income_deadline | time | الوقت لتذكير إدخال الدخل |
| daily_sales_target | decimal | |
| enable_notifications | bool | |
| enable_customer_reminders | bool | |
| enable_low_stock_alerts | bool | |
| enable_behavior_analysis | bool | |
| behavior_analysis_days | int | |
| behavior_drop_threshold | decimal | |
| whatsapp_template | text | |
| created_at, updated_at | | |

## 9. الإشعارات

### notifications
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| recipient_user_id | FK nullable | لو null = لكل المدراء |
| customer_id | FK nullable | |
| type | enum (انظر الأنواع) | |
| title | string | |
| message | text | |
| status | enum: pending / sent / read | |
| scheduled_at | timestamp nullable | |
| sent_at | timestamp nullable | |
| read_at | timestamp nullable | |
| created_at | | |

أنواع الإشعارات:
```text
daily_income_missing
daily_income_below_target
customer_credit_limit
monthly_profit_report
customer_debt_reminder
customer_behavior_alert
low_stock
large_transaction
permission_denied_attempt
```

### notification_templates
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| code | string | معرّف القالب |
| channel | enum: internal / whatsapp | |
| title_template | text | |
| body_template | text | متغيرات: {customer_name} ... |
| is_active | bool | |
| created_at, updated_at | | |

### scheduled_jobs
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| job_type | string | |
| run_at | timestamp | |
| status | enum: pending / running / done / failed | |
| payload_json | JSON | |
| error_text | text nullable | |
| created_at, updated_at | | |

## 10. سجل الحركات والتقارير

### audit_logs
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| user_id | FK nullable | nullable لو دخول فاشل |
| action | string | مثل `customer_transaction.create_debt` |
| entity_type | string | مثل `customer_transaction` |
| entity_id | UUID nullable | |
| old_values | JSON nullable | |
| new_values | JSON nullable | |
| ip_address | string | |
| user_agent | string | |
| created_at | timestamp | |

### report_snapshots
| الحقل | النوع | |
|---|---|---|
| id | UUID PK | |
| store_id | FK | |
| report_code | string | |
| period_start, period_end | date | |
| data_json | JSON | snapshot للتقرير |
| created_by | FK | |
| created_at | | |

## 11. العلاقات الرئيسية

```text
stores 1─────* users
users  *─────* roles  (via user_roles)
roles  *─────* permissions (via role_permissions)
stores 1─────* customers
customers 1──* customer_transactions
stores 1─────* sales 1──* sale_items
sales  *─────? customers
stores 1─────* suppliers 1──* supplier_transactions
stores 1─────* purchases 1──* purchase_items
purchases *──? suppliers
stores 1─────* expenses
expenses *───? expense_categories
expenses *───? suppliers   (لو type = supplier_payment)
stores 1─────* products 1──* stock_movements
stock_movements *──? sale | purchase   (via reference_type+reference_id)
stores 1─────* notifications
all tables  ─→ audit_logs (logical reference)
```

## 12. الفهارس المقترحة

```text
INDEX customers(store_id, name)
INDEX customer_transactions(store_id, customer_id, transaction_date)
INDEX sales(store_id, sale_date)
INDEX sale_items(sale_id, product_id)
INDEX suppliers(store_id, name)
INDEX supplier_transactions(store_id, supplier_id, transaction_date)
INDEX purchases(store_id, purchase_date)
INDEX expenses(store_id, expense_date, type)
INDEX products(store_id, name, barcode)
INDEX stock_movements(store_id, product_id, movement_date)
INDEX notifications(store_id, recipient_user_id, status)
INDEX audit_logs(store_id, user_id, created_at)
INDEX audit_logs(entity_type, entity_id)
UNIQUE(daily_incomes.store_id, income_date)
```

## 13. قواعد ثابتة على مستوى DB

1. كل العمليات المالية تُكتب داخل `prisma.$transaction`.
2. `current_balance` لا يُحدَّث إلا من الباكند داخل transaction.
3. لا حذف نهائي للجداول المالية: نستخدم `cancelled_at` أو `deleted_at`.
4. كل تعديل/إلغاء يكتب في `audit_logs` مع old & new values.
5. الـ permissions جدول مرجعي يُملأ من seed، لا يُعدَّل من الواجهة.
