# دفتر البقالة — Grocery Ledger

<div dir="rtl">

تطبيق أندرويد **محاسبي متكامل للبقالات الصغيرة**: يعمل بلا إنترنت، مستخدم واحد، جهاز واحد، بيانات محلية بالكامل.
أُعيدت كتابته من نظام الويب القديم (`legacy/web-system/`) إلى Flutter مع محرك محاسبي مُتحقَّق منه بالاختبارات.

| | |
|---|---|
| **الإصدار** | 2.0.0 (build 2) |
| **الحزمة** | `com.groceryledger.accounts` |
| **المنصة** | Android 5.0+ (armv7 / arm64 / x86_64) |
| **الحجم** | ~13MB (arm64) — [`dist/`](dist/) |
| **الحالة** | `flutter analyze` 0 مشاكل · **78 اختبار ناجح** |
| **المطوّر** | **معين العباسي** · [alabbasi.uk](https://alabbasi.uk) · +967770941666 |

---

## المزايا

### الكاشير (نقطة البيع) — «طق طق طق»
- مسح الباركود بالكاميرا (ML Kit) أو بقارئ USB/بلوتوث (HID) أو كتابته يدويًا
- صوت + اهتزاز عند كل مسح، زيادة الكمية تلقائيًا عند تكرار الصنف
- أصناف سريعة (الأكثر بيعًا)، خصم، بيع نقدي أو آجل على عميل
- إيصال 80mm / فاتورة A4 فورًا بعد البيع (مشاركة/طباعة)

### الدفاتر (append-only)
- **العملاء**: دين، سداد، تسوية، رصيد افتتاحي، حد ائتمان، تجميد، فترة سماح، كشف حساب
- **الموردون**: مشتريات آجلة، سداد، كشف حساب
- **المبيعات / المشتريات**: إجمالي فقط أو بنود مفصّلة، إلغاء يعكس الأثر دون حذف
- **المصروفات** بفئات، **الدخل اليومي**، **المخزون** بتكلفة وتنبيه نقص
- كل حركة تحفظ `الرصيد قبل / بعد` — الأرصدة تُشتق من الدفتر وليست حقلًا قابلًا للتلاعب
- سجل تدقيق، تنبيه المعاملات الكبيرة، حماية PIN، نسخ احتياطي/استعادة JSON

### هوية المحل على كل مطبوعة
من **المزيد ← هوية المحل والطباعة**: الشعار، اسم المحل، المالك، الهاتف، العنوان، **البيان العلوي** و**البيان السفلي** — تُطبع على كل فاتورة وإيصال وكشف وتقرير وملصق.

### التقارير والتصدير
| المستند | PDF | Excel |
|---|:-:|:-:|
| فاتورة A4 / إيصال 80mm | ✓ | — |
| كشف حساب عميل / مورد | ✓ | ✓ |
| تقرير الفترة (يوم/أسبوع/شهر/90 يوم/سنة/مخصص) | ✓ | ✓ |
| **تقرير شهري** (أي شهر من آخر 24) | ✓ | ✓ |
| تقرير المخزون | ✓ | ✓ |
| ملصقات باركود (3 أحجام، نسخ متعددة) | ✓ | — |

كل مستند: **مشاركة** (واتساب/إيميل/درايف) · **طباعة** (حوار أندرويد الأصلي) · **حفظ**.
خط عربي مضمّن (Noto Naskh Arabic) لتشكيل صحيح داخل PDF.

### الواجهة
Material 3 · RTL كامل · ثيم فاتح/داكن/نظام · أرقام غربية ثابتة · حالات فارغة مصمّمة لكل شاشة.

---

## البنية

```
lib/
├─ main.dart                 نقطة الدخول، بوابة PIN
├─ app/                      AppServices (تجميع الخدمات)، AppShell (التبويبات)
├─ core/
│  ├─ money/                 Money (قرش صحيح) و Qty (جزء من ألف) — بلا أعداد عشرية
│  ├─ platform/              NativeBridge (صوت/اهتزاز/روابط/اتصال) عبر MethodChannel
│  ├─ theme/  utils/  widgets/  (ماسح الباركود، محرّر البنود، أزرار التصدير)
├─ domain/
│  ├─ enums/                 PaymentType, DocMode, RefType, ProfitMode, AppThemeMode…
│  └─ models/                Customer/Supplier/PartyTx, Sale/Purchase/Expense, Product/StockMove, AppSettings
├─ data/
│  ├─ kv_backend.dart        Hive أو Memory (للاختبارات)
│  ├─ ledger_db.dart         الحالة الكاملة + الاشتقاقات (أرصدة، مخزون)
│  ├─ services/              Party / Document / Inventory / Report / Settings
│  └─ export/                PdfBrand, PdfExporter, ExcelExporter, ShareService
└─ features/                 شاشة لكل ميزة (pos, customers, suppliers, sales, purchases,
                             expenses, daily_income, inventory, products, reports, settings, audit, more)
```

**قواعد المحرك** (تُختبر آليًا في `test/domain/ledger_test.dart`):
- لا حذف لحركات مالية — إلغاء فقط مع عكس الأثر
- `balanceAfter` لكل حركة = `balanceBefore ± amount` وتساوي رصيد الطرف المشتق
- الفاتورة الآجلة تُنشئ حركة دين مرتبطة (`refType = sale`) لا يمكن إلغاؤها مباشرة
- المشتريات النقدية تُنشئ مصروفًا مرتبطًا؛ الإلغاء يتعاقب
- التصدير ← المسح ← الاستيراد يُعيد الأرصدة بدقة

---

## التشغيل والبناء

```bash
flutter pub get
flutter analyze
flutter test                       # 78 اختبار
flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/debug-info
```

الناتج في `build/app/outputs/flutter-apk/` (ونُسخ جاهزة في `dist/`).
التوقيع: `android/key.properties` + `android/release-key.jks` (غير مرفوعين — راجع `.gitignore`).

**البيئة المثبتة:** Flutter 3.35.4 · Dart 3.9.2 · compileSdk 35 · Java 17.

---

## التوثيق
- [`docs/RESEARCH.md`](docs/RESEARCH.md) — دراسة سوق البقالات، تدفق الكاشير، النموذج المحاسبي، الهوية والتصدير، قرار الإدخال الصوتي
- [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) — دليل صاحب المحل خطوة بخطوة
- [`CHANGELOG.md`](CHANGELOG.md) — سجل الإصدارات
- [`legacy/web-system/`](legacy/web-system/) — نظام الويب القديم (NestJS + React) كمرجع محفوظ

## الترخيص والحقوق
جميع الحقوق محفوظة © 2026 معين العباسي — [alabbasi.uk](https://alabbasi.uk)

</div>
