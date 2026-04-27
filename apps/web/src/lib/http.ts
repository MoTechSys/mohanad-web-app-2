import axios, { type AxiosInstance } from 'axios';

/**
 * HTTP client مشترك لكل التطبيق.
 * - في dev: نمرّ عبر Vite proxy (`/api/*` و `/health` → http://localhost:3001)
 * - في prod: VITE_API_URL يضبط الـ baseURL مباشرة (مثل https://api.example.com)
 * - withCredentials = true لإرسال refresh token (httpOnly cookie).
 *
 * في المرحلة 2 سنضيف:
 *   • interceptor للـ Authorization: Bearer <accessToken> من Zustand
 *   • interceptor للـ 401 → /auth/refresh → retry
 *   • Idempotency-Key generator للـ POSTs المالية
 */

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});
