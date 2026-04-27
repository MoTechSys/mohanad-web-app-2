# خطوط النظام

> هذا المجلد محجوز لخطوط النظام المحلية (self-hosted).
>
> **القرار المعتمد (docs/12-agent-memory.md — C1):**
> - **IBM Plex Sans Arabic Variable** (~45KB) — الخط الأساسي
> - **JetBrains Mono Variable** — أرقام الجداول الجدولية (`tabular-nums`)
> - `font-display: swap`

## الملفات المتوقعة

```
public/fonts/
├── ibm-plex-sans-arabic-variable.woff2
└── jetbrains-mono-variable.woff2
```

## التحميل

في المرحلة 1 (Foundation) **لا نُحمِّل ملفات ثقيلة** للاحتفاظ بـ commit نظيف.
- يُستخدم `system-ui` كـ fallback مؤقت.
- في المرحلة 2 سنضيف ملفات woff2 المضغوطة (~45KB لكل ملف).

عند توفر الملفات، سيتم تفعيلها من `src/design/fonts.css`.
