# المساهمة في دفتر البقالة

<div dir="rtl">

## قبل أي تعديل
1. اقرأ [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) كاملًا — خاصة §3 «المبادئ غير القابلة للكسر» و§3.8 «صندوق جديد = 3 أماكن».
2. البيئة **مقفولة**: Flutter 3.35.4 · Dart 3.9.2 · Java 17. لا `flutter upgrade`، لا تحديث حزم في `pubspec.yaml` دون اختبار كامل.

## سير العمل
```bash
git checkout genspark_ai_developer        # فرع التطوير
# ... عدّل ...
dart format lib test
flutter analyze                            # 0 مشاكل — إلزامي
flutter test                               # كل الاختبارات — إلزامي
git commit -m "feat(مX): ..."              # انظر أسلوب الرسائل أدناه
git push
# عند اكتمال مرحلة: PR → main
```
CI: القالب في `.github/ci.yml.template` — **لتفعيله** انسخه إلى `.github/workflows/ci.yml` من حساب المالك (توكن الأتمتة لا يملك صلاحية `workflows`). بعد التفعيل يعيد نفس الفحوص على GitHub.

## أسلوب رسائل الـ commit
`<type>(<scope>): <وصف عربي مختصر>` ثم سطر فارغ ثم تفاصيل.
- `feat(م7): ...` ميزة · `fix: ...` إصلاح · `docs: ...` توثيق · `build(android): ...` بناء · `style: ...` تنسيق فقط · `test: ...` اختبارات · `refactor: ...`
- اذكر عدد الاختبارات بعد التغيير (مثل `157/157`).

## قواعد لا تُكسر
- **لا حذف** لأي حركة مالية — إلغاء مع عكس الأثر فقط.
- **لا `double`** للمال أو الكميات — `Money` (قرش) و`Qty` (جزء من ألف).
- **enums تُسلسل بالفهرس** — أضف في النهاية فقط، لا تحذف ولا تُعِد الترتيب.
- **حقل جديد في نموذج** = قيمة افتراضية في `fromMap` (النسخ القديمة يجب أن تُقرأ).
- **صندوق Hive جديد** = `Boxes.all` + `_hydrate` + `_allCollections` + `exportJson/importJson`.
- **كل ميزة لها اختبار** في `test/domain/` أو `test/features/`.
- **لا `print`**، لا `withOpacity` — استخدم `debugPrint` داخل `kDebugMode` و`withValues(alpha:)`.

## الإصدار
راجع [`docs/RELEASE.md`](docs/RELEASE.md) — الكيستور، الأوامر، النشر على Releases.

## اللغة
الكود والتعليقات التقنية بالإنجليزية أو العربية (كما هو قائم)؛ كل نصوص الواجهة والتوثيق الموجّه للمستخدم **بالعربية**.

</div>
