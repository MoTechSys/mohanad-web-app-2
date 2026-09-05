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
| compileSdk / targetSdk / minSdk | 36 / 36 / 24 (افتراضيات Flutter 3.35 — `flutter.compileSdkVersion` إلخ) |
| Gradle / AGP / Kotlin | 8.12 / 8.9.1 / 2.1.0 |
| Gradle JVM | `-Xmx4G` (كان 8G — OOM على أجهزة 8GB) |
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
عدم التمرير يُبقي القيمة، تمرير `null` يمسحها. مطبَّق في `Product.copyWith` على `expiryDate` **و`barcode`** (v2.2.1).
وعلى مستوى الخدمة: `updateProduct(expiryDate:, clearExpiry: bool)` و`updateProduct(barcode: '')` يمسح الباركود (`null` = بلا تغيير).

> ⚠️ **لا تستخدم `x ?? this.x` لحقل nullable قابل للمسح** — يخلط بين «بلا تغيير» و«امسح». هذا بالضبط ما سبّب تخزين `''` في الباركود قبل 2.2.1.

### 3.8 صندوق (Box) جديد = 3 أماكن إلزامية
عند إضافة مجموعة بيانات جديدة (مثل `vouchers`، `cashSessions`):
1. `Boxes.all` + `_hydrate` في `LedgerDb.load()`.
2. **`LedgerDb._allCollections`** — تُستخدم في `wipeAll()`. هناك `assert` يفشل في الاختبارات إن نسيتها (`_allCollections.length == Boxes.all.length - 1`).
3. `SettingsService.exportJson/importJson`.

> 🐞 **الدرس (v2.2.1)**: `cashSessions` أُضيفت في 1 و3 ونُسيت في 2 → «وردية شبح» تعود بعد الاستعادة لأن `importJson` يكتب الذاكرة كلها للقرص بعد `wipeAll`. الاختبار `regression v2.2.1` في `cash_session_test.dart` يحرس هذا.

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
│  ├─ platform/native_bridge.dart  MethodChannel 'grocery_ledger/native' (صوت/اهتزاز/sendSms / showNotification (قناة grocery_alerts + إذن POST_NOTIFICATIONS على 33+) / saveToDownloads (MediaStore → Download/دفتر البقالة))
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

## 5. الاختبارات (157/157)

```bash
flutter analyze && flutter test   # يجب أن يكونا نظيفين قبل أي commit
```

| الملف | يغطي |
|---|---|
| test/domain/money_test.dart · ledger_test.dart · units_and_guards_test.dart | المحرك |
| test/domain/voucher_test.dart · tafqit_test.dart | السندات والتفقيط |
| test/domain/cash_session_test.dart | الورديات (8) — منها regression الوردية الشبح + wipeAll |
| test/domain/expiry_test.dart | الصلاحية (6) |
| test/domain/backup_service_test.dart | النسخ اليومي gzip (7) |
| test/domain/ui_settings_test.dart | إعدادات م6 (5) |
| test/features/* | شاشات + SMS |

**خطافات الاختبار**: `SmsService.sender` · `NativeBridge.spy` · `ShareService.spy` ·
`AppServices.withBackend(MemoryBackend())` ثم `await app.init()`.

**فخاخ معروفة**:
- `PeriodSummary.cashIn` يشمل `otherReceipts` (سندات قبض لجهات خارجية) منذ 2.2.1 — يطابق `ZReport.cashIn`. سندات العملاء تُعدّ ضمن `customerPayments` (سطر دفتر) ولا تُحسب مرتين.
- الباركود يُطبَّع دائمًا بـ `LedgerDb.normalizeBarcode` (إنشاء/تعديل/بحث) — لا تقارن نصًا خامًا.
- `createCustomer(openingBalance:)` — ليس openingDebt.
- `createSale(paymentType:, mode: DocMode.totalOnly, totalAmount:)`.
- `Money.abs` getter — بدون أقواس.
- `common.dart` → `DateField` سقفه غدًا؛ للتواريخ المستقبلية (كالصلاحية) استخدم `showDatePicker` مخصص (مثال في ProductFormSheet).

## 6. سير العمل مع Git/GitHub (توجيه المالك: كل شيء في GitHub)

- **المستودع**: `https://github.com/MoTechSys/mohanad-web-app-2` — عام.
- **الفروع**: `main` = المستقر والمنشور (الافتراضي) · `genspark_ai_developer` = التطوير. عند اكتمال مرحلة: PR → `main` (قالب PR جاهز في `.github/`).
- **CI**: القالب جاهز في `.github/ci.yml.template` (format check + `analyze --fatal-infos` + `test` + APK smoke). **تفعيله خطوة واحدة من حساب المالك**: `git mv .github/ci.yml.template .github/workflows/ci.yml && git push` — توكن الأتمتة (GitHub App) لا يملك صلاحية `workflows` فلا يستطيع رفعه. بعد التفعيل أعد ضبط حماية `main` لتطلب فحص `analyze + test`.
- بعد كل معلم: analyze نظيف + الاختبارات كلها + CHANGELOG + **commit + push**.
- **GitHub هو المرجع الوحيد** بقرار المالك. الإصدارات (APK) على **Releases** فقط، لا في المستودع (`dist/` مُتجاهَل).
- التاريخ أُعيدت كتابته مرة بـ `git filter-repo` (حُذفت APKs/legacy) — **لا تدفع ملفات ثنائية كبيرة** إطلاقًا.
- ملفات التوقيع `android/key.properties` + `android/release-key.jks` **غير مرفوعة** (gitignore) — إدارتها وبصمتها في [`RELEASE.md`](RELEASE.md).
- إن فشل push بمصادقة: أعد تشغيل أداة إعداد GitHub (قد تترك `~/.git-credentials` فارغًا أول مرة).

### 6.1 الاستئناف من الصفر على جهاز/جلسة جديدة (خطوة بخطوة)
```bash
# 1) الأدوات — نفس الإصدارات تمامًا (لا أحدث)
#    Flutter 3.35.4 (stable) · Java 17 · Android SDK: platform 36 + build-tools 35.0.0
git clone https://github.com/MoTechSys/mohanad-web-app-2.git flutter_app && cd flutter_app
flutter --version          # يجب 3.35.4 / Dart 3.9.2

# 2) التبعيات والتحقق (يجب أن يكون كل شيء أخضر قبل أي تعديل)
flutter pub get && flutter analyze && flutter test

# 3) (للإصدار فقط) استرجع الكيستور من النسخة المشفَّرة — RELEASE.md §1
gpg -d keystore-backup.tar.gz.gpg | tar xzf - -C android/
keytool -list -v -keystore android/release-key.jks -alias release | grep SHA256   # طابق البصمة

# 4) اقرأ بالترتيب: README → هذا الملف (§3 المبادئ، §3.8 الفخ) → CHANGELOG (آخر مدخل) → RELEASE.md
# 5) ابدأ على فرع التطوير
git checkout genspark_ai_developer
```
> **معاينة ويب للتطوير فقط** (لا تُرفع): `flutter create . --platforms web` ثم `flutter build web --release` وسيرفر بايثون على 5060. بعدها احذف مخلفات `flutter create` (`web/` مُتجاهَل أصلًا؛ استرجع `.metadata` و`test/widget_test.dart` إن أُنشئا).

### 6.2 خريطة الوثائق — أين أجد ماذا؟
| السؤال | الملف |
|---|---|
| ما هذا التطبيق وماذا يفعل؟ | `README.md` |
| كيف أطوّر دون أن أكسر المحاسبة؟ | `docs/DEVELOPMENT.md` (هذا) |
| كيف أبني وأوقّع وأنشر إصدارًا؟ أين الكيستور؟ | `docs/RELEASE.md` |
| قواعد المساهمة ورسائل commit | `CONTRIBUTING.md` |
| ماذا تغيّر في كل إصدار؟ | `CHANGELOG.md` |
| كيف يستخدمه صاحب المحل؟ | `docs/USER_GUIDE.md` |
| لماذا صُمّم هكذا؟ (دراسة السوق، القرارات) | `docs/RESEARCH.md` |
| الملفات الجاهزة للتثبيت | GitHub → Releases |

## 7. البناء والإصدار

التفاصيل الكاملة (الكيستور، الأوامر، lite، النشر، جدول الإصدارات) في **[`RELEASE.md`](RELEASE.md)**. المختصر:

```bash
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/debug-info \
  --target-platform android-arm64,android-arm          # موقّع تلقائيًا via key.properties
# lite (نموذج الباركود عبر Play Services): أضف -Pdev.steenbakker.mobile_scanner.useUnbundled=true
```
- الإصدار الحالي: **2.2.1+5** — ارفع `version:` في pubspec **و** `AboutScreen.version` عند كل إصدار.
- الحجم: 13.3MB arm64 (قياسي) / 10.2MB (lite). تفصيل «أين تذهب الميغابايتات» في README.
- ⚠ **لا تعد إضافة** legacy/dist/web للتتبع.

## 8. حالة المتطلبات (م1–م6 من الملاحظات الصوتية «جعبوس1»)

| # | المتطلب | الحالة | Commit |
|---|---|---|---|
| م1 | وحدات متعددة (كرتون/جوتة/قرطاس) + ضوابط البيع | ✅ | — |
| م2 | سندات قبض/صرف بتفقيط + SMS مباشر | ✅ | 56a1c4b |
| م3 | ورديات صندوق + تقرير Z مجمّد + طباعة 80mm | ✅ | 59cee53 |
| م4 | تواريخ صلاحية + تنبيهات لوحة التحكم + وسوم | ✅ | aea5e2e |
| م5 | نسخ يومي تلقائي (backup-YYYY-MM-DD.json، آخر 7) | ✅ | 8dc8f90 |
| م6 | نسخ .glbak مضغوط بمجلد مرئي (Android/media) + استعادة فورية بقائمة + إشعار صلاحية محلي + تقرير أرباح PDF + معاينة لكل التقارير + شبكة أيقونات للمزيد + hideScanner/largeFont + ثيم أزرق + أيقونة جديدة + حفظ في Download/دفتر البقالة | ✅ | 6cfb779 |
| تدقيق | إصلاح وردية شبح، مسح الباركود، otherReceipts، تحذير الاستعادة، تنظيف Gradle، توثيق | ✅ 2.2.1+5 | 157/157 |

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
