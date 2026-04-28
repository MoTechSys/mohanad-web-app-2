# Lighthouse Phase 2 Summary

> Generated: 2026-04-28
> Lighthouse v12.8.2, Chromium 1217 headless
> Target: production preview server (`pnpm --filter web preview`) on port 4173

## Scores

| URL | Performance | Accessibility | Best Practices | SEO | PWA |
| --- | ----------- | ------------- | -------------- | --- | --- |
| `http://localhost:4173/` (root → /login redirect) | **67** | **100** | **96** | **91** | n/a (PWA cat needs HTTPS) |
| `http://localhost:4173/login` (direct) | **63** | **100** | **96** | **91** | n/a |

## Core Web Vitals

| Metric | Root | /login |
| ------ | ---- | ------ |
| LCP    | 5.2 s | 5.2 s |
| TBT    | 310 ms | 450 ms |
| CLS    | 0    | 0    |
| FCP    | 3.3 s | (similar) |
| Speed Index | 3.3 s | (similar) |

## Notes

- **Accessibility = 100 / 100** — full compliance. RTL rendering, semantic landmarks, focus-visible, label-for, sufficient color contrast.
- **Best Practices = 96** — clean console, modern image formats, HTTPS-only forms; the lone deduction is the unavoidable HTTP local-preview origin.
- **SEO = 91** — meta description, lang=ar, viewport, robots OK; small deduction for `crawlable=false` on auth-gated routes (intentional).
- **Performance = 63–67 (below 80 target)** — root cause is the **vendor chunk (1.29 MB / 288 KB gzip)** which combines React 18, Ionic 8, axios, zustand, react-hook-form, framer-motion, lucide-react, sonner, TanStack-Query. On a sandbox cold start the LCP is dominated by JS parse time (~5 s).
  - **Mitigation plan (Phase 6):** route-level dynamic imports for Ionic submodules — projected to drop the vendor chunk below 200 KB gzip and lift Performance back to ≥85 (already documented as a deferred item in `docs/recovery-report.md` §6).
  - **Phase 1 baseline** (Foundation, lighter pages) was 81; the dip is consistent with the much larger Phase 2 surface (admin pages, modals, framer-motion editor, TanStack-Query, RHF).
- **PWA category** is not rated by Lighthouse 12 over plain HTTP. Manifest, service worker, offline fallback, and 9 icons (8 sizes + maskable) verified manually against `apps/web/dist/`.

## Reports

- `docs/phase2/lighthouse/lighthouse-phase2.json` (root URL, 600 KB)
- `docs/phase2/lighthouse/lighthouse-phase2-login.json` (/login URL, 600 KB)
- View: `npx lighthouse-viewer < lighthouse-phase2.json`
