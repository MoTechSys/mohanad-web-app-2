import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * Shared HTTP client — Phase 2 P2-5.
 *
 *   • dev: requests pass through Vite proxy (`/api/*` → http://localhost:3001)
 *   • prod: VITE_API_URL points to the deployed Railway service
 *   • withCredentials = true (refresh-token cookie support)
 *
 * Request interceptor:
 *   1. Inject `Authorization: Bearer <accessToken>` from `useAuthStore`.
 *   2. Generate an `Idempotency-Key` (UUID v4) for every state-changing
 *      request (POST / PUT / PATCH / DELETE).
 *
 * Response interceptor (per spec):
 *   • 401 — single retry: call `/auth/refresh`, replay the original
 *           request with the fresh access token. Concurrent 401s share
 *           the same in-flight refresh promise so we never hammer the
 *           refresh endpoint.
 *   • 403 — surface a localized "permission denied" toast.
 *   • 429 — extract `lockedUntil` / `retryAfterSec` from the envelope;
 *           the LoginPage uses these to render the countdown.
 *   • 5xx — surface a generic "server error" toast.
 *
 * Toast handler is injected at runtime by the app shell so this module
 * stays free of React imports (testable in isolation).
 */

// ─── Toast bridge (set by ToastProvider once mounted) ────────────────
type ToastVariant = 'info' | 'success' | 'warning' | 'error';
type ToastFn = (variant: ToastVariant, message: string) => void;

let toastSink: ToastFn | null = null;

export function setHttpToastSink(fn: ToastFn | null): void {
  toastSink = fn;
}

function emitToast(variant: ToastVariant, message: string): void {
  toastSink?.(variant, message);
}

// ─── Axios instance ──────────────────────────────────────────────────
const baseURL = import.meta.env.VITE_API_URL ?? '';

export const http: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Lazy import to avoid circular dependency with the auth store. */
async function getAuthStore(): Promise<typeof import('@/stores/authStore').useAuthStore> {
  const mod = await import('@/stores/authStore');
  return mod.useAuthStore;
}

// ─── Request interceptor ─────────────────────────────────────────────
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Bearer token from in-memory store (sync read via dynamic import).
  try {
    const useAuthStore = await getAuthStore();
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers?.set?.('Authorization', `Bearer ${token}`);
    }
  } catch {
    /* noop — store not yet initialised (very early bootstrap) */
  }

  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const existing = config.headers?.get?.('Idempotency-Key');
    if (!existing) {
      const id =
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      config.headers?.set?.('Idempotency-Key', id);
    }
  }

  return config;
});

// ─── Response interceptor ────────────────────────────────────────────
interface RetryableConfig extends AxiosRequestConfig {
  /** Set after one refresh attempt to prevent infinite loops. */
  _retried?: boolean;
}

interface ErrorEnvelope {
  data: null;
  meta?: {
    error?: {
      statusCode?: number;
      message?: string;
      code?: string;
      lockedUntil?: string;
      retryAfterSec?: number;
    };
  };
}

/** Coalesce concurrent 401s into a single refresh round-trip. */
let refreshInFlight: Promise<boolean> | null = null;
async function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const useAuthStore = await getAuthStore();
        return await useAuthStore.getState().refresh();
      } finally {
        // Reset on next tick so back-to-back requests don't share a stale promise.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

/** Endpoints that should NEVER trigger an auto-refresh on 401. */
const REFRESH_EXEMPT = ['/auth/refresh', '/auth/login', '/auth/logout'];

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorEnvelope>) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const envelope = error.response?.data?.meta?.error;
    const url = (config?.url ?? '').toLowerCase();

    // ── 401 → refresh + replay (once) ────────────────────────────
    if (
      status === 401 &&
      config &&
      !config._retried &&
      !REFRESH_EXEMPT.some((p) => url.includes(p))
    ) {
      config._retried = true;
      const ok = await refreshOnce();
      if (ok) {
        // refresh() updated the access token; replay the request
        return http.request(config);
      }
      // refresh failed → fall through to surface 401 to caller
    }

    // ── 403 → localized denial toast ─────────────────────────────
    if (status === 403) {
      const msg = envelope?.message ?? 'لا تملك صلاحية للقيام بهذا الإجراء';
      emitToast('error', msg);
    }

    // ── 429 → no toast (LoginPage owns countdown UI) ─────────────
    //    We DO leave lockedUntil / retryAfterSec in the envelope so the
    //    caller can read them via `error.response.data.meta.error`.

    // ── 5xx → generic toast ──────────────────────────────────────
    if (status !== undefined && status >= 500) {
      emitToast('error', envelope?.message ?? 'حدث خطأ في الخادم، يرجى المحاولة لاحقاً');
    }

    return Promise.reject(error);
  },
);
