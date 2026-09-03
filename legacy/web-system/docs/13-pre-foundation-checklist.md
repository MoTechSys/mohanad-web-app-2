# 13 — قائمة فحص ما قبل مرحلة Foundation

> هذه القائمة مستخرجة من مراجعة ملفات التوثيق الـ13 (`docs/00`–`docs/12`) ومقارنتها مع المواصفات الأصلية في `00-project-overview.md` و `01-requirements-analysis.md`.
> الهدف: تأكيد كل افتراض اتخذه المساعد قبل البدء فعلياً في كتابة الكود.

---

## القسم 1 — أسئلة مفتوحة (Open Questions)

> افتراضات وضعها المساعد ولم تُؤكَّد صراحة في المواصفات الأصلية. كل بند هنا يحتاج إجابة "نعم/لا/تعديل" منك.

### 1.1 افتراضات منتجية (Product)

- [ ] **A1 — الوضع الداكن (Dark Mode):** هل تؤكّد تأجيله لـ v2؟ (افتراض المساعد: ❌ مؤجل)
- [ ] **A2 — تعدد العملات (Multi-currency):** هل يكفي رمز نصي واحد في الإعدادات بدون أسعار صرف؟ (افتراض المساعد: نعم، نص فقط)
- [ ] **A3 — الفروع والكاشيرز:** هل v1 = متجر واحد فعلاً، و `storeId` للتحضير المستقبلي فقط؟ (افتراض المساعد: نعم)
- [ ] **A4 — الأرصدة الافتتاحية:** هل تريد فعلاً حقول `openingCashBalance` و `openingBalance` للعملاء/التجار في v1؟ (افتراض المساعد: نعم، مفعّلة)
- [ ] **A5 — Approval Workflow للعمليات الكبيرة:** هل v1 = رفض مباشر فقط (ForbiddenException) بدون جدول طلبات اعتماد؟ (افتراض المساعد: نعم)
- [ ] **A6 — رصيد عميل سالب:** هل تسمح بالرصيد السالب (= العميل دائن للبقالة) مع badge وتقرير منفصل؟ (افتراض المساعد: نعم، مسموح)
- [ ] **A7 — طريقة الدخول:** username + password (bcrypt rounds=12) + Remember Me — هل تريد PIN كبديل أو إضافة لاحقاً؟ (افتراض المساعد: لا PIN في v1)
- [ ] **A8 — حد المعاملة الكبيرة:** الافتراضي 50,000 — هل هذا مناسب لعملتك؟
- [ ] **A9 — Idempotency-Key:** المساعد فرض هذا header على كل POSTs المالية — هل توافق على إلزاميته؟
- [ ] **A10 — Soft Delete على كل شيء أم المالي فقط:** المواصفات الأصلية تذكر "العمليات المالية" فقط، لكن المساعد طبّقه أيضاً على `customers`/`suppliers`/`products`. هل توافق؟

### 1.2 افتراضات تقنية إضافية (Technical Extras)

- [ ] **TE1 — استخدام `cuid()`** لـ IDs بدلاً من `uuid` أو auto-increment. (افتراض المساعد)
- [ ] **TE2 — `Decimal(14, 2)`** لجميع الحقول المالية. (افتراض المساعد — يكفي 14 رقم؟)
- [ ] **TE3 — JWT lifetimes:** Access 15 دقيقة + Refresh 7 أيام (30 يوم مع Remember Me). (افتراض المساعد)
- [ ] **TE4 — bcrypt rounds = 12** بالتحديد. (افتراض المساعد)
- [ ] **TE5 — Refresh في httpOnly cookie + Access في Zustand memory.** (افتراض المساعد)
- [ ] **TE6 — Rate Limiting عام:** 100 req/min على كل المستخدمين. (افتراض المساعد — لا يوجد في المواصفات الأصلية)
- [ ] **TE7 — `constraints_json`** يبقى عمود في الـ schema لكن غير مُستخدم منطقياً في v1. (افتراض المساعد)
- [ ] **TE8 — Pino redaction** لحقول `password`, `token`, `cookie` في اللوجز. (افتراض المساعد)

### 1.3 افتراضات UI/UX

- [ ] **UX1 — الخط الأساسي:** المواصفات الأصلية ذكرت 3 خيارات (Tajawal / IBM Plex Sans Arabic / Noto Naskh) — المساعد ثبّت **IBM Plex Sans Arabic Variable** فقط. هل توافق؟
- [ ] **UX2 — اللون الأساسي #059669 (Emerald-600):** غير محدد في المواصفات الأصلية. هل تريد لوناً مختلفاً؟
- [ ] **UX3 — الأرقام إنجليزية (0-9):** المواصفات الأصلية قالت "حسب التفضيل، الافتراضي إنجليزية" — المساعد جعلها **قطعية**. هل توافق؟
- [ ] **UX4 — 5 تبويبات سفلية ديناميكية + تبويب "المزيد".** (افتراض المساعد — لم يُذكر العدد في المواصفات)
- [ ] **UX5 — نقطة التبديل بين Modal و Bottom Sheet عند 768px.** (افتراض المساعد)
- [ ] **UX6 — `JetBrains Mono Variable` للأرقام في الجداول** (~ ميجا إضافي على bundle). هل تقبل التكلفة؟

---

## القسم 2 — تعارضات (Conflicts)

> نقاط ظهر فيها اختلاف بين المواصفات الأصلية والوثائق المُولَّدة بواسطة المساعد.

| # | المواصفات الأصلية (`00`/`01`) | وثائق المساعد (`02`–`12`) | تعليق |
|---|---|---|---|
| C1 | الأرقام: "حسب التفضيل، الافتراضي إنجليزية للأرقام المالية" (`05-ui-ux` سطر 21) | "إنجليزية 0-9 **قاطعاً**" (`12-agent-memory` C3) | تشدُّد دون داعٍ — المواصفة الأصلية تركت المجال للمستخدم |
| C2 | الخط: 3 خيارات مقترحة (Tajawal / IBM Plex / Noto Naskh) (`05-ui-ux` سطر 25) | IBM Plex Sans Arabic Variable **فقط** (`12-agent-memory` C1) | اختيار وحيد دون مبرر تقني واضح |
| C3 | "Audit Log: لكل إنشاء/تعديل/إلغاء/حذف ناعم" — لا يحدد old/new قطعياً (`01-requirements` §14) | إلزام `old_values` و `new_values` لكل عملية + IP + UA | تشدُّد إضافي (مقبول لكن يستحق التأكيد) |
| C4 | "Soft delete" مذكور للعملاء والتجار والمنتجات (`01-requirements`) | تطبيق Soft Delete على **كل شيء** بما فيه users و roles | توسيع نطاق |
| C5 | Rate Limiting **غير مذكور** في المواصفات | 100 req/min عبر `ThrottlerGuard` (`12-agent-memory`) | إضافة جديدة |
| C6 | "العملة تُختار من الإعدادات (مثل ريال يمني)" (`00-overview` §3) | حقل `currency` نصي بدون validation للقائمة | لا تعارض حاد، لكن يستحق سؤال: هل تريد قائمة محددة (ISO 4217) أم نص حر؟ |
| C7 | "زر واتساب برسالة جاهزة" (`00-overview` §7.9) | لم تُحدد قوالب الرسائل في `09-notifications.md` تفصيلياً | فجوة لا تعارض |
| C8 | المواصفات لا تذكر `Idempotency-Key` | المساعد جعله إلزامياً على POSTs المالية (`12-agent-memory` golden rules) | إضافة جديدة |
| C9 | "بقالة واحدة في v1 مع store_id" (`00-overview`) | `Setting` مرتبط بـ `storeId` ويتطلب إنشاء Store قبل أي إعداد | تعقيد إضافي مقبول للتحضير المستقبلي |

---

## القسم 3 — قرارات تقنية معلَّقة (Technical Decisions Pending)

> الخيارات الفعلية التي يجب تثبيتها قبل البدء في Foundation. المساعد اقترح قراراً لكل بند في `12-agent-memory.md` — يلزم تأكيدك أو تعديلك.

> ⚠️ **ملاحظة مهمة:** بعض هذه القرارات قام المساعد بـ **تنفيذها فعلياً في الكود** أثناء جلسة Foundation (NestJS + nestjs-pino + Scalar + ...). أي تغيير الآن يعني إعادة كتابة جزء من الكود.

### 3.1 إدارة الحزم (Package Manager)

- [ ] **القرار المقترح:** `pnpm@9` (workspaces، بدون Turborepo)
- [ ] خيارات أخرى: `npm` workspaces / `yarn` v4
- [ ] **الحالة:** ✅ مُنفَّذ بالفعل (`pnpm-workspace.yaml` موجود، 4 حزم)
- 📌 **سؤالي لك:** هل تؤكد pnpm أم تفضل التراجع لـ npm؟

### 3.2 Testing Framework

| البند | الاقتراح | بدائل |
|---|---|---|
| Backend (apps/api) | **Jest** (الافتراضي مع NestJS) | Vitest |
| Frontend (apps/web) | **Vitest** + React Testing Library | Jest |
| Shared (packages/shared) | **Vitest** | Jest |

- [ ] **الحالة:** ⚠️ Vitest مُثبَّت في shared و web، Jest غير مُثبَّت بعد في api
- 📌 **سؤالي لك:** Vitest في كل المونوريبو (توحيد) أم Jest في الباك + Vitest في الفرونت (الأفضل أداءً لكل بيئة)؟

### 3.3 إدارة الحالة (State Management) — Frontend

| النوع | الاقتراح | البدائل |
|---|---|---|
| Server State | **TanStack Query (React Query)** | SWR |
| Client/Auth State | **Zustand** | Context API / Redux Toolkit |

- [ ] **الحالة:** ✅ مُنفَّذ (Zustand store + QueryClientProvider في `App.tsx`)
- 📌 **سؤالي لك:** هل تفضل Redux Toolkit (أكثر شيوعاً للأنظمة الإدارية الكبيرة) أم تبقى Zustand (أبسط وأخف)؟

### 3.4 HTTP Client

- [ ] **القرار المقترح:** **Axios** + `withCredentials: true` (لـ refresh cookie) ملفوف داخل **TanStack Query**
- [ ] بدائل: `fetch` الأصلي + TanStack Query فقط / `ky` / `ofetch`
- [ ] **الحالة:** ✅ مُنفَّذ (`apps/web/src/lib/http.ts` يستخدم Axios)
- 📌 **سؤالي لك:** هل تريد Axios (interceptors قوية للـ refresh) أم fetch (أخف bundle)؟

### 3.5 Form Library

- [ ] **القرار المقترح:** **React Hook Form + zodResolver**
- [ ] البديل: Formik + Yup
- [ ] **الحالة:** ⚠️ مُثبَّت في `package.json` لكن لم تُستخدم بعد
- 📌 **سؤالي لك:** RHF أم Formik؟ (RHF أسرع وأخف، لكن Formik أكثر "تقليدية")

### 3.6 Validation Library

- [ ] **القرار المقترح:** **Zod** موحَّد عبر `packages/shared/src/schemas/` للباك والفرونت معاً + `nestjs-zod` للـ DTOs
- [ ] البديل: **Yup** (للفرونت) + **class-validator** (للباك) — تكرار للمنطق
- [ ] **الحالة:** ✅ مُنفَّذ (Zod مُثبَّت في shared، schemas/auth و schemas/common كُتبت)
- 📌 **سؤالي لك:** Zod موحَّد (موصى به) أم Yup + class-validator (التقليدي مع NestJS)؟

### 3.7 Date Library

- [ ] **القرار المقترح:** **dayjs** + `dayjs/plugin/relativeTime` + `dayjs/locale/ar` (~7KB)
- [ ] البديل: **date-fns** (أكبر لكن tree-shakable) / **Luxon** / `Intl.DateTimeFormat` الأصلي (بدون مكتبة)
- [ ] **الحالة:** ❌ غير مُثبَّت بعد
- 📌 **سؤالي لك:** dayjs (الأصغر) أم date-fns (الأكثر شيوعاً)؟

### 3.8 i18n — هل نحتاج إطار عمل i18n؟

> المواصفات الأصلية: **عربي فقط، RTL**. لا حاجة فعلية لـ i18n في v1.

| الخيار | الإيجابيات | السلبيات |
|---|---|---|
| **(A) ملف `i18n/ar.ts` بسيط** (مقترح المساعد) | بسيط، خفيف، بدون dependency | هجرة لاحقة لو احتجنا إنجليزية |
| **(B) `react-i18next` من الآن** | جاهزية لإضافة لغات لاحقاً | ~30KB إضافية بدون فائدة في v1 |
| **(C) لا ملف ترجمة أصلاً، النصوص inline** | الأبسط | فوضى صيانة |

- [ ] **القرار المقترح:** الخيار (A)
- 📌 **سؤالي لك:** هل تريد فتح الباب للإنجليزية في v2 (= استخدم react-i18next الآن)، أم نلتزم بالعربية فقط ونؤجل (= ملف بسيط)؟

### 3.9 Backend Logger

- [ ] **القرار المقترح:** **`nestjs-pino`** (سريع جداً، JSON structured logs، redaction للأسرار)
- [ ] البديل: **Winston** (أكثر شيوعاً، plugins أكثر، أبطأ قليلاً)
- [ ] **الحالة:** ✅ مُنفَّذ (nestjs-pino في `app.module.ts` و redaction نشط)
- 📌 **سؤالي لك:** Pino (الأسرع) أم Winston (الأكثر شعبية)؟

### 3.10 API Documentation Tool

- [ ] **القرار المقترح:** **Swagger UI** (`/docs`) + **Scalar** (`/reference`) + JSON spec (`/docs-json`) — الثلاثة معاً
- [ ] البديل: Swagger فقط / Scalar فقط / Redoc
- [ ] **الحالة:** ✅ مُنفَّذ (الثلاثة يردون 200)
- 📌 **سؤالي لك:** هل تحتاج الاثنين (Swagger + Scalar) أم واحد يكفي؟ Scalar أجمل لكنه أحدث.

---

## ملخص للقرار السريع (TL;DR)

أرجو الرد على الأسئلة التالية بـ "موافق" أو بالتعديل المطلوب:

| # | البند | اقتراح المساعد | إجابتك |
|---|---|---|---|
| 1 | Package Manager | pnpm | ⬜ |
| 2 | Backend Tests | Jest | ⬜ |
| 3 | Frontend Tests | Vitest | ⬜ |
| 4 | State Management | Zustand + TanStack Query | ⬜ |
| 5 | HTTP Client | Axios + TanStack Query | ⬜ |
| 6 | Forms | React Hook Form | ⬜ |
| 7 | Validation | Zod (موحَّد) | ⬜ |
| 8 | Date Library | dayjs | ⬜ |
| 9 | i18n | ملف ar.ts بسيط (لا framework) | ⬜ |
| 10 | Backend Logger | Pino | ⬜ |
| 11 | API Docs | Swagger + Scalar | ⬜ |
| 12 | Dark Mode | مؤجل لـ v2 | ⬜ |
| 13 | Multi-currency | نص فقط بدون أسعار صرف | ⬜ |
| 14 | Idempotency-Key | إلزامي على POSTs المالية | ⬜ |
| 15 | Rate Limit | 100 req/min عام | ⬜ |
| 16 | Decimal | (14, 2) | ⬜ |
| 17 | bcrypt rounds | 12 | ⬜ |
| 18 | JWT lifetimes | 15min/7d/30d | ⬜ |
| 19 | الخط | IBM Plex Sans Arabic Variable | ⬜ |
| 20 | اللون الأساسي | #059669 (Emerald-600) | ⬜ |

> بمجرد ما تجاوب على هذه الـ20 نقطة، يمكننا تثبيت `12-agent-memory.md` كقرار نهائي والمتابعة بثقة في باقي مراحل التنفيذ (Auth → Modules → Reports → ...).
