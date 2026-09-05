# دليل التطوير — دفتر البقالة (وثيقة تسليم شاملة)

<div dir="rtl">

> **الغرض**: هذه الوثيقة تمكّن أي مطوّر (أو جلسة ذكاء اصطناعي جديدة) من مواصلة التطوير
> **دون فقدان أي معلومة**. اقرأها كاملة قبل أول تعديل.

---

## 1. البيئة المثبتة (مقفلة — لا تُحدَّث أبدًا)

| المكوّن | الإصدار |
|---|---|
| Flutter | **3.35.4** (لا `flutter upgrade`) |
| Dart | **3.9.2** |
| Java | OpenJDK 17.0.2 |
| compileSdk / buildTools | 35 / 35.0.0 |
| مسار المشروع | `/home/user/flutter_app` |

**المنصة أندرويد فقط.** مجلدات `web/ ios/ linux/ macos/ windows/` محذوفة ومحجوبة في `.gitignore`.
لمعاينة الويب محليًا (لا تُرفع): `flutter create . --platforms web && flutter build web --release` ثم سيرفر Python على 5060 — واحذف مخلفات `flutter create` (`test/widget_test.dart` + استرجع `.metadata`).

## 2. الحزم (إصدارات مثبتة في pubspec.yaml)

hive 2.2.3 · hive_flutter 1.1.0 · provider 6.1.5+1 · intl 0.20.2 · mobile_scanner 7.1.4 · pdf 3.11.3 · printing 5.14.2 · excel 4.0.6 · share_plus 10.1.4 · path_provider 2.1.5 · image_picker 1.1.2

**لا تضف حزمة تتطلب Flutter/Dart أحدث.** لا Firebase — التطبيق أوفلاين بالكامل.

## 3. المبادئ المعمارية (غير قابلة للكسر)

### 3.1 دفاتر append-only
- **لا حذف أبدًا** لأي حركة مالية. الإلغاء فقط (`cancelledAt` + `cancelReason`) مع **عكس الأثر** بحركة مضادة أو بتعطيل السطر.
- **الأرصدة والمخزون مشتقة** من الدفاتر (`LedgerDb.customerBalance/stockOf`) — ليست حقولًا مخزنة.
- كل حركة طرف (`PartyTx`) تحمل `balanceBefore/balanceAfter`.

### 3.2 وحدة العمل
كل عملية كتابة داخل `db.run(() { ... })` — يجمع التعديلات ثم يفرغها **بترتيب ثابت**:
الدفاتر قبل الرؤوس (راجع `_flushOrder` في `ledger_db.dart` — `vouchers, cash_sessions, sales, ...`).

### 3.3 الأرقام صحيحة دائمًا (لا double)
- `Money`: قروش صحيحة، scale=100. **تنبيه: `.abs` خاصية (getter) وليست دالة** — `m.abs` لا `m.abs()`.
- `Qty`: أجزاء الألف، scale=1000.

### 3.4 التسلسل البشري لا يُعاد استخدامه
`RV-0001` (قبض) / `PV-0001` (صرف) / `Z-0001` (وردية) — الترقيم بمسح **كل** السجلات بما فيها الملغاة/المغلقة (max-scan).

### 3.5 التوافق الخلفي للنسخ الاحتياطية
- التعدادات (enums) تُسلسل بالفهرس → **الإضافة في نهاية القائمة فقط، لا حذف ولا إعادة ترتيب أبدًا**.
- صندوق/حقل جديد = اختياري بقيمة افتراضية في `fromMap` (المفاتيح الغائبة → `[]` أو `null`).
- التسلسل الزمني عبر `Serde.dt` (epoch millis) — **ليس ISO strings**.

### 3.6 نمط sentinel في copyWith (لمسح الحقول الاختيارية)
```dart
const Object _unset = Object();
// في copyWith:
Object? expiryDate = _unset,
// ...
expiryDate: identical(expiryDate, _unset) ? this.expiryDate : expiryDate as DateTime?,
```
عدم التمرير يُبقي القيمة، تمرير `null` يمسحها. مطبَّق في `Product.copyWith` وغيره.
وعلى مستوى الخدمة: `updateProduct(expiryDate:, clearExpiry: bool)`.

### 3.7 التجميد عند الإغلاق (م3)
`expectedCash` يُحسب **لحظة إغلاق الوردية ويُخزَّن** في `CashSession` — الإلغاءات اللاحقة لا تغيّر تقرير Z الرسمي.

## 4. خريطة الكود

```
lib/
├─ main.dart                  إقلاع + النسخ اليومي التلقائي (unawaited) + PinGate
├─ app/
│  ├─ app_services.dart       جذر التركيب: parties, inventory, documents, reports,
│  │                          settings, vouchers, sms, shifts, backup, pdf, excel, share
│  └─ shell.dart              التبويبات السفلية
├─ core/
│  ├─ money/                  Money + Qty (صحيحة)
│  ├─ platform/native_bridge.dart  MethodChannel 'grocery_ledger/native' (صوت/اهتزاز/sendSms)
│  ├─ utils/formatters.dart   Fmt.date/dateTime/money/relative
│  └─ widgets/common.dart     guarded() / confirm() / confirmWithReason() / MoneyField /
│                             QtyField / DateField(⚠ lastDate=غدًا) / PickerField / showFormSheet
├─ domain/
│  ├─ enums/enums.dart        كل التعدادات (append-only!) + ErrorCodes
│  └─ models/                 party, documents, inventory(+expiryDate), voucher,
│                             cash_session(+ZReport), settings, serde
├─ data/
│  ├─ kv_backend.dart         HiveBackend (إنتاج) / MemoryBackend (اختبارات)
│  ├─ ledger_db.dart          الصناديق + hydrate + flush + الاشتقاقات
│  ├─ services/
│  │  ├─ party_service.dart · document_service.dart · inventory_service.dart
│  │  ├─ voucher_service.dart · cash_session_service.dart · sms_service.dart
│  │  ├─ report_service.dart  (+lowStock/expiringSoon/expiredProducts)
│  │  ├─ settings_service.dart (exportJson/importJson — كل الصناديق)
│  │  └─ backup_service.dart  (م5: يومي تلقائي، آخر 7)
│  └─ export/                 pdf_exporter (فواتير/كشوف/سندات A5+80mm/zReport80)،
│                             excel_exporter، share_service (sharePdf/printPdf/spy)
└─ features/                  شاشة لكل ميزة: pos, sales, customers, suppliers, purchases,
                              expenses, daily_income, products, inventory, reports,
                              vouchers, shifts, settings, audit, dashboard, more
```

### Kotlin (أندرويد أصلي)
`android/.../MainActivity.kt`: معالج `sendSms` عبر SmsManager + طلب صلاحية `SEND_SMS`
وقت التشغيل مع **إعادة المحاولة بعد المنح** (pendingSms) + تقسيم الرسائل الطويلة (multipart).
`AndroidManifest.xml`: `SEND_SMS` + `telephony required=false`.

## 5. الاختبارات (143/143)

```bash
flutter analyze && flutter test   # يجب أن يكونا نظيفين قبل أي commit
```

| الملف | يغطي |
|---|---|
| test/domain/money_test.dart · ledger_test.dart · units_and_guards_test.dart | المحرك |
| test/domain/voucher_test.dart · tafqit_test.dart | السندات والتفقيط |
| test/domain/cash_session_test.dart | الورديات (6) |
| test/domain/expiry_test.dart | الصلاحية (6) |
| test/domain/backup_service_test.dart | النسخ اليومي (3) |
| test/features/* | شاشات + SMS |

**خطافات الاختبار**: `SmsService.sender` · `NativeBridge.spy` · `ShareService.spy` ·
`AppServices.withBackend(MemoryBackend())` ثم `await app.init()`.

**فخاخ معروفة**:
- `createCustomer(openingBalance:)` — ليس openingDebt.
- `createSale(paymentType:, mode: DocMode.totalOnly, totalAmount:)`.
- `Money.abs` getter — بدون أقواس.
- `common.dart` → `DateField` سقفه غدًا؛ للتواريخ المستقبلية (كالصلاحية) استخدم `showDatePicker` مخصص (مثال في ProductFormSheet).

## 6. سير العمل مع Git/GitHub (توجيه المالك: كل شيء في GitHub)

- **المستودع**: `https://github.com/MoTechSys/mohanad-web-app-2.git` · الفرع: `genspark_ai_developer`
- بعد كل معلم: `analyze` نظيف + الاختبارات كلها ناجحة + قسم في CHANGELOG + **commit + push**.
- **لا نسخ احتياطية محلية للمشروع** (ProjectBackup) — GitHub هو المرجع الوحيد بقرار المالك.
- التاريخ أُعيدت كتابته بـ `git filter-repo` (حُذفت APKs القديمة و legacy) — لا تدفع ملفات ثنائية كبيرة.
- ملفات التوقيع `android/key.properties` + `android/release-key.jks` موجودة محليًا **وغير مرفوعة** (gitignore).
- إن فشل push بمصادقة: أعد تشغيل أداة إعداد GitHub (يُعرف أنها قد تترك `~/.git-credentials` فارغًا أول مرة).

## 7. البناء والإصدار

```bash
flutter build apk --release --split-per-abi   # موقّع تلقائيًا via key.properties
# الناتج: build/app/outputs/flutter-apk/  (~13.4-14.4MB لكل معمارية)
```
- الإصدار الحالي: **2.1.0+3** — ارفع `version:` في pubspec عند كل إصدار.
- build.gradle.kts مضبوط: minify + shrinkResources + legacy jniLibs + خط عربي واحد.
- ⚠ حجم المستودع كان 276MB وخُفض إلى ~42MB — **لا تعد إضافة** legacy/dist/web للتتبع.

## 8. حالة المتطلبات (م1–م5 من الملاحظات الصوتية «جعبوس1»)

| # | المتطلب | الحالة | Commit |
|---|---|---|---|
| م1 | وحدات متعددة (كرتون/جوتة/قرطاس) + ضوابط البيع | ✅ | — |
| م2 | سندات قبض/صرف بتفقيط + SMS مباشر | ✅ | 56a1c4b |
| م3 | ورديات صندوق + تقرير Z مجمّد + طباعة 80mm | ✅ | 59cee53 |
| م4 | تواريخ صلاحية + تنبيهات لوحة التحكم + وسوم | ✅ | aea5e2e |
| م5 | نسخ يومي تلقائي (backup-YYYY-MM-DD.json، آخر 7) | ✅ | 8dc8f90 |

## 9. أفكار مستقبلية (لم يطلبها المالك بعد — اقترحها قبل التنفيذ)

- إشعار أندرويد محلي عند اقتراب انتهاء صلاحية (بدل التنبيه الداخلي فقط)
- مشاركة النسخة التلقائية لواتساب مباشرة من قائمة النسخ
- تقرير أرباح شهري PDF مخصص
- تعدد المستخدمين/الأجهزة (خارج النطاق الحالي عمدًا — التطبيق أوفلاين جهاز واحد)

## 10. قواعد التعامل مع المالك

- الرد **بالعربية** دائمًا.
- سلامة البيانات فوق كل شيء: لا حذف، append-only، توافق خلفي للنسخ.
- وثّق كل معلم في CHANGELOG + commit + push فورًا (GitHub هو التوثيق).
- لا تُحدّث Flutter/Dart/الحزم — الإصدارات مقفلة.

</div>
