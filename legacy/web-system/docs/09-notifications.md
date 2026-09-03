# 09 - نظام الإشعارات

## 1. القنوات المدعومة في v1

| القناة | الحالة |
|---|---|
| Internal (داخل التطبيق) | ✅ مدعومة |
| WhatsApp (زر برسالة جاهزة) | ✅ مدعوم (يدوي - يفتح واتساب فقط) |
| WhatsApp API تلقائي | ❌ مؤجل لما بعد v1 |
| البريد الإلكتروني | ❌ مؤجل |
| SMS | ❌ مؤجل |
| Push Notifications | ❌ مؤجل |

## 2. أنواع الإشعارات الداخلية

```text
daily_income_missing            : لم يُدخل دخل اليوم بعد deadline
daily_income_below_target       : دخل اليوم أقل من الهدف
customer_credit_limit           : عميل تجاوز سقف الدين
monthly_profit_report           : تقرير شهري جاهز
customer_debt_reminder          : تذكير لإرسال حساب لعميل
customer_behavior_alert         : انخفاض شراء عميل (تحليل السلوك)
low_stock                       : منتج وصل الحد الأدنى (إذا المخزون مفعل)
large_transaction               : عملية كبيرة تحتاج موافقة
permission_denied_attempt       : عامل حاول الوصول لشيء غير مصرح
supplier_credit_threshold       : دين تاجر تجاوز حد معين
```

## 3. هيكل الإشعار

```text
notifications:
  id, store_id,
  recipient_user_id (nullable = للجميع المؤهلين),
  customer_id (nullable),
  type,
  title (string),
  message (text),
  status: pending | sent | read,
  scheduled_at, sent_at, read_at,
  created_at
```

## 4. القوالب (Templates)

`notification_templates`:
- `code` معرّف القالب.
- `channel` = internal أو whatsapp.
- `title_template`, `body_template`.
- يدعم متغيرات: `{customer_name}`, `{balance}`, `{currency}`, `{store_name}`, `{last_transaction_date}`, `{today_date}`, `{user_name}`, `{amount}`.

أمثلة:

### Internal: تجاوز السقف
```text
title: تنبيه: تجاوز سقف الدين
body : العميل {customer_name} تجاوز السقف الحالي. الرصيد: {balance} {currency}.
```

### Internal: دخل اليوم مفقود
```text
title: لم يتم إدخال دخل اليوم
body : لم يُدخل دخل اليوم {today_date} بعد. الرجاء التأكد من تسجيله.
```

### Internal: محاولة وصول مرفوضة
```text
title: محاولة وصول مرفوضة
body : المستخدم {user_name} حاول الوصول إلى {entity_type} بدون صلاحية.
```

### WhatsApp: تذكير عميل
```text
الأخ {customer_name}
رصيدكم المستحق لدى {store_name} هو {balance} {currency}
آخر عملية بتاريخ: {last_transaction_date}
نرجو السداد، وشكراً.
```

## 5. آلية إرسال الإشعار الداخلي

1. الباكند ينشئ صف في `notifications` بـ `status = pending`.
2. عند جلب /notifications من المستخدم، يستلمها مع `is_read = false`.
3. الفرونت يعرض جرس + badge بعدد غير المقروءة.
4. عند الضغط: `POST /notifications/:id/read` → `status = read`, `read_at = now`.

## 6. آلية زر واتساب

في صفحة العميل (مثلاً كشف حساب):

```text
[ زر واتساب أخضر ]
↓
يبني رسالة من template + متغيرات العميل الفعلية
↓
يفتح: https://wa.me/<phone>?text=<encodeURIComponent(message)>
↓
المستخدم يضغط إرسال داخل تطبيق واتساب يدوياً
↓
الفرونت يستدعي POST /notifications/whatsapp/log
↓
الباكند يسجل في audit + ينشئ notification نوع customer_debt_reminder بـ status = sent
```

> الفرق المهم: النظام **لا يرسل تلقائياً عبر API**. زر فقط، الإرسال يدوي من المستخدم.

## 7. الإشعارات المجدولة (Scheduled)

تستخدم جدول `scheduled_jobs` + worker (يمكن استخدام BullMQ + Redis لاحقاً، أو cron داخل NestJS بـ `@nestjs/schedule` في v1).

أمثلة Jobs:
| Job | متى يعمل | ماذا يفعل |
|---|---|---|
| daily_income_check | بعد deadline يومياً | إذا لم يُدخل دخل اليوم → ينشئ notification `daily_income_missing` |
| monthly_profit_report | أول يوم في الشهر | يحسب ربح/خسارة الشهر السابق وينشئ تقرير + notification |
| customer_reminders | حسب جدولة كل عميل | يولد notification + يحضّر رسالة واتساب |
| behavior_analysis | يومياً ليلاً | يحسب متوسطات ويولد customer_behavior_alert |
| low_stock_check | بعد كل stock_movement | فوري + بدون scheduled |

## 8. إعدادات الإشعارات

من جدول `settings`:
```text
enable_notifications: bool
enable_customer_reminders: bool
enable_low_stock_alerts: bool
enable_behavior_analysis: bool
daily_income_deadline: time
daily_sales_target: decimal
behavior_analysis_days: int
behavior_drop_threshold: decimal
whatsapp_template: text
```

من جدول `customer_reminder_settings` (لكل عميل):
```text
enabled: bool
frequency_type: days | weekly | monthly
frequency_value: int
next_run_at: timestamp
message_template: text
```

## 9. تذكير العملاء بالحساب

UX:
1. في صفحة العميل: زر "إعداد تذكير".
2. اختيار التكرار: كل X يوم / أسبوعي / شهري.
3. اختيار قالب الرسالة.
4. النظام يحسب next_run_at.
5. عند الموعد: ينشئ notification داخلي للمدير + يعرض زر "فتح واتساب" مع الرسالة الجاهزة.
6. المدير يضغط الزر → يفتح واتساب → يرسل يدوياً.

## 10. صلاحيات الإشعارات

```text
notifications.view_own              : إشعاراته فقط
notifications.view_all              : كل إشعارات المتجر
notifications.create                : إنشاء إشعار يدوي
notifications.mark_read             : تعليم كمقروء
notifications.manage_settings       : تعديل إعدادات الإشعارات
notifications.manage_templates      : إدارة قوالب الرسائل
notifications.send_internal         : إرسال إشعار داخلي يدوي
notifications.send_whatsapp         : فتح زر واتساب وتسجيل الفعل
notifications.schedule_customer_reminders : جدولة تذكيرات
notifications.cancel_scheduled      : إلغاء تذكير مجدول
```

## 11. الهيدر في الفرونت

- جرس مع badge.
- ضغط → فتح Sheet/قائمة بالإشعارات (آخر 20).
- زر "عرض الكل".
- Filter: غير مقروء / الكل / حسب النوع.

## 12. التسجيل في Audit

كل إشعار حساس يجب تسجيله:
- إنشاء/إرسال إشعار يدوي.
- جدولة/إلغاء تذكير.
- تغيير قالب رسالة.
- تغيير إعدادات الإشعارات.
- فتح زر واتساب لعميل.
