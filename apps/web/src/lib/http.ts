import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/stores/authStore';

/**
 * Shared HTTP client.
 *
 *   • dev: requests pass through Vite proxy (`/api/*` → http://localhost:3001)
 *   • prod: VITE_API_URL points to the deployed Railway service
 *   • withCredentials = true (refresh-token cookie support)
 *
 * Foundation interceptors:
 *   1. Inject `Authorization: Bearer <accessToken>` from `useAuthStore`.
 *   2. Generate an `Idempotency-Key` for every state-changing request
 *      (POST/PUT/PATCH/DELETE) — actual server enforcement is Phase 2.
 *
 * Refresh-on-401 retry logic is added in Phase 2 alongside `/auth/refresh`.
 */

const baseURL = import.meta.env.VITE_API_URL ?? '';

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Adds the bearer token (when available) to outgoing requests. */
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers?.set?.('Authorization', `Bearer ${token}`);
  }

  // Auto-attach Idempotency-Key for unsafe methods.
  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!config.headers?.get?.('Idempotency-Key')) {
      const id =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      config.headers?.set?.('Idempotency-Key', id);
    }
  }

  return config;
});

/** Surface server errors with the unified envelope shape. */
http.interceptors.response.use(
  (response) => response,
  (error) => {
    // Phase 2: handle 401 → refresh → retry. For now, simply propagate.
    return Promise.reject(error);
  },
);
