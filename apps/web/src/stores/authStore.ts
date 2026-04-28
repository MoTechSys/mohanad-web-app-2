import { create } from 'zustand';

/**
 * Auth Store (Foundation placeholder)
 *
 * - Access token kept in memory ONLY (B1) — never persisted.
 * - Refresh token lives in an httpOnly cookie set by the API.
 * - The actual `login()` / `logout()` calls land in Phase 2; this
 *   store ships now so consumers (axios interceptor, PermissionGate)
 *   can subscribe immediately.
 */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  storeId: string;
  roles: string[];
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setSession: (payload: { user: AuthUser; accessToken: string }) => void;
  setAccessToken: (token: string | null) => void;
  clearSession: () => void;
  hasPermission: (code: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setSession: ({ user, accessToken }) => set({ user, accessToken, isAuthenticated: true }),

  setAccessToken: (token) => set({ accessToken: token, isAuthenticated: Boolean(token) }),

  clearSession: () => set({ user: null, accessToken: null, isAuthenticated: false }),

  hasPermission: (code) => {
    const u = get().user;
    if (!u) return false;
    return u.permissions.includes(code);
  },
}));
