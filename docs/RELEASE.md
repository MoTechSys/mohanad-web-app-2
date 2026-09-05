# دليل الإصدار والتوقيع — دفتر البقالة

<div dir="rtl">

> **الغرض**: أي شخص يملك هذا المستودع + ملف الكيستور يستطيع إخراج إصدار جديد مطابق تمامًا
> ويُثبَّت **فوق** النسخة الموجودة عند العملاء دون فقدان بياناتهم. اقرأ قسم الكيستور أولًا.

---

## 1. الكيستور (الأهم — لا يمكن استرجاعه)

أندرويد يرفض تحديث تطبيق مثبَّت إن اختلفت شهادة التوقيع. **فقدان الكيستور = العملاء لا يستطيعون التحديث أبدًا** إلا بحذف التطبيق وبياناته (يمكن استعادة البيانات من النسخ الاحتياطية `.glbak`، لكن تجربة سيئة).

| البيان | القيمة |
|---|---|
| الملف | `android/release-key.jks` (**غير مرفوع في git عمدًا** — راجع `.gitignore`) |
| الخصائص | `android/key.properties` (**غير مرفوع**) — يحوي `storePassword`, `keyPassword`, `keyAlias`, `storeFile=../release-key.jks` |
| Alias | `release` |
| الخوارزمية | RSA / SHA384withRSA |
| الصلاحية | 2026-09-05 → **2054-01-21** |
| **بصمة SHA-256** | `B8:90:BD:50:39:1C:5E:27:FD:A9:DB:F2:70:11:1E:C3:09:51:44:7E:9F:74:D7:0A:BE:6B:4B:10:5C:CB:0E:9A` |

### 1.1 أين تُحفظ نسخ الكيستور؟
احتفظ بـ **3 نسخ على الأقل** في أماكن منفصلة، كل واحدة تضم `release-key.jks` + `key.properties`:
1. مدير كلمات المرور (Bitwarden / 1Password) كمرفق مشفّر — **الأفضل**.
2. Google Drive / iCloud في مجلد خاص (الملف نفسه مشفَّر بكلمة المرور، لكن لا ترفعه مع `key.properties` في نفس المكان بصيغة مكشوفة).
3. أرشيف مشفَّر `keystore-backup.tar.gz.gpg` (أمر الإنشاء أدناه) على USB أو مساحة سحابية.

```bash
# إنشاء أرشيف مشفَّر (يطلب كلمة مرور — احفظها في مدير كلمات المرور)
cd android && tar czf - release-key.jks key.properties | gpg -c --cipher-algo AES256 -o ../keystore-backup.tar.gz.gpg

# فك الأرشيف عند الاستئناف على جهاز جديد
gpg -d keystore-backup.tar.gz.gpg | tar xzf - -C android/
```

### 1.2 التحقق أن الكيستور هو الصحيح
```bash
keytool -list -v -keystore android/release-key.jks -alias release | grep SHA256
# يجب أن يطابق البصمة أعلاه حرفًا بحرف.

# أو تحقق من APK منشور:
apksigner verify --print-certs grocery-ledger-2.2.1-arm64.apk | grep SHA-256
# b890bd50391c5e27fda9dbf270111ec30951447e9f74d70abe6b4b105ccb0e9a
```

### 1.3 لو ضاع الكيستور فعلًا
1. أنشئ كيستورًا جديدًا: `keytool -genkey -v -keystore release-key.jks -alias release -keyalg RSA -keysize 2048 -validity 10000`.
2. **غيّر `applicationId`** (مثل `com.groceryledger.accounts2`) وإلا سيفشل التثبيت فوق القديم. حدّث أيضًا `namespace`، مسار `MainActivity.kt`، و`BackupService.packageName`.
3. أخبر المستخدمين: خذ نسخة احتياطية من التطبيق القديم → ثبّت الجديد → استعد النسخة.
4. حدّث هذا الملف بالبصمة الجديدة.

---

## 2. قائمة فحص ما قبل الإصدار

```bash
flutter pub get
flutter analyze                 # يجب: No issues found!
flutter test                    # يجب: All tests passed! (157+)
```

- [ ] `pubspec.yaml` → `version: X.Y.Z+N` (رفع `N` دائمًا؛ `versionCode` النهائي = `ABI_PREFIX*1000 + N` تلقائيًا مع split-per-abi: arm64 → `2000+N`، armv7 → `1000+N`)
- [ ] `lib/features/more/more_screen.dart` → `AboutScreen.version = 'X.Y.Z'`
- [ ] `CHANGELOG.md` → مدخل جديد في الأعلى
- [ ] `README.md` → جدول الإصدار/الحجم/عدد الاختبارات
- [ ] `docs/DEVELOPMENT.md` → جدول حالة المتطلبات (§8) إن تغيّر شيء

---

## 3. البناء

```bash
# القياسي — نموذج الباركود مضمّن (أوفلاين 100%) — 13.3MB arm64
flutter build apk --release --split-per-abi --obfuscate \
  --split-debug-info=build/debug-info \
  --target-platform android-arm64,android-arm

# lite — نموذج الباركود عبر Play Services (يحتاج إنترنت مرة عند أول مسح) — 10.2MB arm64
flutter build apk --release --split-per-abi --obfuscate \
  --split-debug-info=build/debug-info-lite \
  --target-platform android-arm64,android-arm \
  -Pdev.steenbakker.mobile_scanner.useUnbundled=true
```

الناتج: `build/app/outputs/flutter-apk/app-{arm64-v8a,armeabi-v7a}-release.apk`.

> **احتفظ بمجلد `build/debug-info*`** لكل إصدار منشور (خارج git — ارفعه مع الـ Release كـ zip أو خزّنه مع الكيستور). بدونه لا يمكن قراءة stack traces من التطبيق المُعمّى (`flutter symbolize -d build/debug-info -i trace.txt`).

### 3.1 التحقق من الناتج
```bash
B=$ANDROID_HOME/build-tools/35.0.0     # أو أي build-tools مثبّت
$B/apksigner verify --verbose --print-certs app-arm64-v8a-release.apk   # v2: true + البصمة
$B/aapt2 dump badging app-arm64-v8a-release.apk | grep -E "versionCode|versionName|sdkVersion"
```

---

## 4. النشر على GitHub Releases

```bash
mkdir -p dist
cp build/app/outputs/flutter-apk/app-arm64-v8a-release.apk   dist/grocery-ledger-X.Y.Z-arm64.apk
cp build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk dist/grocery-ledger-X.Y.Z-armv7.apk
# (كرّر لـ lite بلاحقة -lite)
cd dist && sha256sum *.apk > SHA256SUMS.txt
```

ثم عبر `gh` (أو واجهة GitHub → Releases → Draft a new release):
```bash
git tag -a vX.Y.Z -m "دفتر البقالة X.Y.Z"
git push origin vX.Y.Z
gh release create vX.Y.Z dist/grocery-ledger-X.Y.Z-*.apk dist/SHA256SUMS.txt \
  --title "دفتر البقالة X.Y.Z (build N) — أندرويد" --notes-file RELEASE_NOTES.md
```

**قاعدة**: ملفات APK **لا تُرفع للمستودع أبدًا** (`dist/` في `.gitignore`) — فقط في Releases.

---

## 5. الفروع

| الفرع | الدور |
|---|---|
| `main` | **الإصدار المستقر** — كل ما فيه مبنيّ ومنشور. الفرع الافتراضي. |
| `genspark_ai_developer` | فرع التطوير (جلسات الذكاء الاصطناعي). يُدمج في `main` عبر PR عند اكتمال مرحلة. |

- كل commit في `main` يجب أن يمرّ `flutter analyze` + `flutter test` (يُفرض آليًا عبر GitHub Actions — `.github/workflows/ci.yml`).
- الـ tags `vX.Y.Z` تُشير دائمًا إلى commit على `main`.

---

## 6. جدول الإصدارات المنشورة

| الإصدار | build | التاريخ | Tag | الحجم arm64 | ملاحظات |
|---|---|---|---|---|---|
| 2.2.1 | 5 | 2026-09-05 | `v2.2.1` | 13.3MB / 10.2MB lite | تدقيق شامل، إصلاح وردية شبح، تقليص الحجم |
| 2.2.0 | 4 | 2026-09-05 | — | 14.0MB | م6 (لم يُنشر كـ Release) |
| 2.0.0 | 2 | 2026-09-03 | — | 13.9MB | أول إصدار Flutter (APKs كانت في `dist/` قبل التنظيف) |

</div>
