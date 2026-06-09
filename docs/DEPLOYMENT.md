# DEPLOYMENT — Grocery System (Railway)

> دليل النشر على **Railway** (Backend + Frontend + PostgreSQL).
> Stack: NestJS API + React/Vite PWA + Prisma + PostgreSQL. Monorepo pnpm.

---

## 1. نظرة عامة (Architecture on Railway)

ثلاث خدمات داخل مشروع Railway واحد:

| الخدمة | المصدر | المنفذ | الوصف |
|--------|--------|--------|-------|
| **PostgreSQL** | Railway plugin | 5432 | قاعدة البيانات. يحقن `DATABASE_URL` تلقائياً. |
| **api** | `apps/api` (railway.json) | `$PORT` | NestJS REST API على `/api/v1`. يطبّق migrations عند الإقلاع. |
| **web** | `apps/web` (railway.json) | `$PORT` | React PWA (vite preview). يتصل بالـ API. |

> الـ API يستمع على `0.0.0.0:$PORT` ويقرأ `DATABASE_URL` فقط (محمول — لا اعتماد على مزوّد معيّن).

---

## 2. خطوات النشر (Steps)

### أ) أنشئ المشروع + قاعدة البيانات
1. أنشئ مشروعاً جديداً على Railway واربطه بمستودع GitHub `moain2026/mohanad-web-app-2`.
2. أضف **PostgreSQL** من Add Plugin → سيُنشئ متغيّر `DATABASE_URL`.

### ب) خدمة الـ API
1. أنشئ خدمة من نفس الريبو، **Root Directory = `apps/api`** (سيلتقط `apps/api/railway.json`).
2. أضف المتغيّرات (Variables):
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}     # reference إلى خدمة Postgres
   NODE_ENV=production
   APP_VERSION=1.0.0
   JWT_ACCESS_SECRET=<openssl rand -base64 48>
   JWT_REFRESH_SECRET=<openssl rand -base64 48>   # مختلف عن الأعلى
   JWT_ACCESS_TTL=15m
   JWT_REFRESH_TTL=7d
   JWT_REFRESH_TTL_REMEMBER_ME=30d
   COOKIE_SECURE=true
   COOKIE_SAMESITE=none        # cross-site بين web و api على نطاقين مختلفين
   WEB_ORIGIN=https://<web-domain>.up.railway.app
   LOG_LEVEL=info
   ```
3. الـ build/start معرّفان في `railway.json` (migrate deploy ثم تشغيل). الـ healthcheck على `/api/v1/health`.

### ج) خدمة الـ Web
1. أنشئ خدمة ثانية، **Root Directory = `apps/web`**.
2. المتغيّرات:
   ```
   VITE_API_URL=https://<api-domain>.up.railway.app
   VITE_ENABLE_SW=true
   ```
   > `VITE_*` تُحقن وقت الـ build. أعد الـ deploy بعد أي تغيير لها.
3. ولّد Domain للخدمتين من Settings → Networking.

### د) أول تشغيل — Seed
الـ migrations تُطبَّق تلقائياً. لزرع البيانات الأولية مرة واحدة (181 صلاحية + 6 أدوار + المالك):
```bash
# من Railway shell على خدمة api، أو محلياً مع DATABASE_URL للإنتاج:
SEED_OWNER_USERNAME=owner SEED_OWNER_PASSWORD='<كلمة-سر-قوية>' \
  pnpm --filter @grocery/api exec tsx ../../prisma/seed.ts
```
> **مهم:** غيّر كلمة سر المالك فوراً بعد أول دخول. لا تترك `Owner@12345` في الإنتاج.

---

## 3. متغيّرات البيئة المطلوبة (مرجع)

راجع `apps/api/src/config/env.validation.ts` — الإلزامية: `DATABASE_URL`, `JWT_ACCESS_SECRET` (≥32)، `JWT_REFRESH_SECRET` (≥32). البقية لها قيم افتراضية.

⚠️ **MOTECH-style note:** الـ JWT secrets تُولَّد لكل بيئة (`openssl rand -base64 48`). لا تُشارك أبداً.

---

## 4. ملاحظات الإنتاج (Production checklist)

- [ ] `COOKIE_SECURE=true` + `COOKIE_SAMESITE=none` (الـ refresh cookie عبر HTTPS و cross-site).
- [ ] `WEB_ORIGIN` يطابق نطاق الـ web بالضبط (CORS credentials).
- [ ] كلمة سر المالك غُيّرت بعد أول دخول.
- [ ] `large_transaction_threshold` و `currency` مضبوطان في الإعدادات حسب المتجر.
- [ ] نسخ احتياطي دوري لقاعدة Postgres (Railway backups أو pg_dump مجدول).
- [ ] راقب `/api/v1/health` (يرجع حالة DB + latency).

---

## 5. النشر اليدوي/المحلي البديل (Docker/VPS)

الـ API محمول: أي بيئة فيها Node 20+ و PostgreSQL تكفي:
```bash
pnpm install --frozen-lockfile
pnpm --filter @grocery/shared build
pnpm --filter @grocery/api exec prisma migrate deploy --schema=../../prisma/schema.prisma
pnpm --filter @grocery/api build
PORT=3001 DATABASE_URL=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... node apps/api/dist/main.js
```
الـ web build (`pnpm --filter @grocery/web build`) ينتج `apps/web/dist/` static — اخدمها بأي web server (Caddy/nginx) مع توجيه `/api` للـ backend.
