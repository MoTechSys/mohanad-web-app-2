import { create } from 'zustand';

import { http } from '@/lib/http';

/**
 * Auth Store — Phase 2 P2-5.
 *
 *   • Access token kept in memory ONLY (never persisted to localStorage).
 *   • Refresh token lives in an httpOnly cookie set by the API.
 *   • `bootstrap()` is called on app mount: it tries `/auth/refresh`
 *     using the cookie. If successful the user lands authenticated;
 *     otherwise we sit on the login screen.
 *
 * State / Action layout follows the spec:
 *   - state    : user, accessToken, isAuthenticated, isBootstrapping,
 *                hasBootstrapped, isLoading, lockout
 *   - actions  : login, logout, logoutAll, refresh, bootstrap, changePassword
 *   - helpers  : hasPermission, hasAnyPermission, hasAllPermissions,
 *                hasRole, clearSession, clearLockout
 */

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  storeId: string;
  roles: string[];
  permissions: string[];
  lastLoginAt?: string | null;
}

export interface LockoutInfo {
  /** ISO date string returned by the API. */
  lockedUntil: string;
  /** Seconds remaining when the 429 was first seen. */
  retryAfterSec: number;
}

interface LoginPayload {
  username: string;
  password: string;
  rememberMe?: boolean;
}

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Shape returned by /auth/login and /auth/refresh (after envelope unwrap). */
interface AuthSuccessPayload {
  accessToken: string;
  accessTokenExpiresInSec?: number;
  refreshTokenExpiresAt?: string;
  user: AuthUser;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** true while the very first /auth/refresh probe is in flight on app mount */
  isBootstrapping: boolean;
  /** true once the bootstrap has finished (success OR failure) */
  hasBootstrapped: boolean;
  /** true while a login/refresh/logout request is pending (UI spinners) */
  isLoading: boolean;
  /** non-null while the current account is locked out (429) */
  lockout: LockoutInfo | null;

  // ── Actions ──────────────────────────────────────────────
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<number>;
  refresh: () => Promise<boolean>;
  bootstrap: () => Promise<void>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;

  // ── Helpers ──────────────────────────────────────────────
  setSession: (payload: { user: AuthUser; accessToken: string }) => void;
  setAccessToken: (token: string | null) => void;
  clearSession: () => void;
  clearLockout: () => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  hasRole: (role: string) => boolean;
}

/** Unwrap the standard `{ data, meta }` envelope. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

/**
 * Try to parse a 429 ACCOUNT_LOCKED payload.  Backend returns
 *   `{ data: null, meta: { error: { code:'ACCOUNT_LOCKED', lockedUntil, retryAfterSec, ... } } }`
 * or in older codepaths a flat `{ lockedUntil, retryAfterSec }`.
 */
function extractLockout(err: unknown): LockoutInfo | null {
  // biome-ignore lint/suspicious/noExplicitAny: defensive parse of arbitrary axios errors
  const data = (err as any)?.response?.data;
  const inner = data?.meta?.error?.lockedUntil
    ? data.meta.error
    : data?.lockedUntil
      ? data
      : data?.error?.lockedUntil
        ? data.error
        : null;
  if (!inner?.lockedUntil) return null;
  const retryAfterSec =
    typeof inner.retryAfterSec === 'number'
      ? inner.retryAfterSec
      : Math.max(0, Math.ceil((new Date(inner.lockedUntil).getTime() - Date.now()) / 1000));
  return { lockedUntil: inner.lockedUntil, retryAfterSec };
}

// Single-flight bootstrap promise (multiple <ProtectedRoute>s share it).
let bootstrapPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isBootstrapping: false,
  hasBootstrapped: false,
  isLoading: false,
  lockout: null,

  // ─── Actions ────────────────────────────────────────────────────────
  login: async ({ username, password, rememberMe = false }) => {
    set({ isLoading: true, lockout: null });
    try {
      const res = await http.post('/api/v1/auth/login', { username, password, rememberMe });
      const payload = unwrap<AuthSuccessPayload>(res.data);
      set({
        user: payload.user,
        accessToken: payload.accessToken,
        isAuthenticated: true,
        hasBootstrapped: true,
      });
      return payload.user;
    } catch (err) {
      const lockout = extractLockout(err);
      if (lockout) set({ lockout });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      // Best-effort: even if the API call fails (e.g. expired token), we
      // wipe the in-memory session so the user really is logged out.
      await http.post('/api/v1/auth/logout').catch(() => null);
    } finally {
      get().clearSession();
      set({ isLoading: false });
    }
  },

  logoutAll: async () => {
    set({ isLoading: true });
    try {
      const res = await http.post('/api/v1/auth/logout-all');
      const payload = unwrap<{ ok: boolean; revoked: number }>(res.data);
      get().clearSession();
      return payload.revoked ?? 0;
    } finally {
      set({ isLoading: false });
    }
  },

  refresh: async () => {
    try {
      const res = await http.post('/api/v1/auth/refresh');
      const payload = unwrap<AuthSuccessPayload>(res.data);
      set({
        user: payload.user,
        accessToken: payload.accessToken,
        isAuthenticated: true,
        hasBootstrapped: true,
      });
      return true;
    } catch {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        hasBootstrapped: true,
      });
      return false;
    }
  },

  bootstrap: async () => {
    if (bootstrapPromise) return bootstrapPromise;
    if (get().hasBootstrapped) return;
    set({ isBootstrapping: true });
    bootstrapPromise = (async () => {
      try {
        await get().refresh();
      } finally {
        set({ isBootstrapping: false, hasBootstrapped: true });
        bootstrapPromise = null;
      }
    })();
    return bootstrapPromise;
  },

  changePassword: async ({ currentPassword, newPassword, confirmPassword }) => {
    set({ isLoading: true });
    try {
      await http.post('/api/v1/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      // Backend revokes ALL sessions ⇒ wipe local state, force re-login.
      get().clearSession();
    } finally {
      set({ isLoading: false });
    }
  },

  // ─── Helpers ────────────────────────────────────────────────────────
  setSession: ({ user, accessToken }) =>
    set({ user, accessToken, isAuthenticated: true, hasBootstrapped: true }),

  setAccessToken: (token) => set({ accessToken: token, isAuthenticated: Boolean(token) }),

  clearSession: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      hasBootstrapped: true,
    }),

  clearLockout: () => set({ lockout: null }),

  hasPermission: (code) => {
    const u = get().user;
    return u ? u.permissions.includes(code) : false;
  },

  hasAnyPermission: (codes) => {
    const u = get().user;
    if (!u) return false;
    if (codes.length === 0) return true;
    const set_ = new Set(u.permissions);
    return codes.some((c) => set_.has(c));
  },

  hasAllPermissions: (codes) => {
    const u = get().user;
    if (!u) return false;
    if (codes.length === 0) return true;
    const set_ = new Set(u.permissions);
    return codes.every((c) => set_.has(c));
  },

  hasRole: (role) => {
    const u = get().user;
    return u ? u.roles.includes(role) : false;
  },
}));
