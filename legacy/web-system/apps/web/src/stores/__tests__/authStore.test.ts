/**
 * Auth Store unit tests — Phase 2 P2-5.
 *
 * We mock `@/lib/http` so the store can be exercised in isolation without a
 * real network. Each test resets store state via `clearSession()` /
 * `clearLockout()` so the suite is order-independent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the http module BEFORE importing the store (Vitest hoists mocks).
vi.mock('@/lib/http', () => {
  return {
    http: {
      post: vi.fn(),
    },
  };
});

import { http } from '@/lib/http';
import { useAuthStore } from '@/stores/authStore';

const mockedPost = http.post as unknown as ReturnType<typeof vi.fn>;

const FAKE_USER = {
  id: 'u-1',
  username: 'owner',
  fullName: 'Owner User',
  storeId: 'store-1',
  roles: ['Owner'],
  permissions: ['users.view', 'users.create', 'roles.view'],
  lastLoginAt: '2026-04-28T00:00:00.000Z',
};

beforeEach(() => {
  mockedPost.mockReset();
  // Reset store between tests.
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isBootstrapping: false,
    hasBootstrapped: false,
    isLoading: false,
    lockout: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('authStore.login', () => {
  it('sets user/accessToken/isAuthenticated on success', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'jwt.123', user: FAKE_USER } },
    });

    const result = await useAuthStore.getState().login({
      username: 'owner',
      password: 'Owner@12345',
    });

    expect(result).toEqual(FAKE_USER);
    const s = useAuthStore.getState();
    expect(s.accessToken).toBe('jwt.123');
    expect(s.user?.username).toBe('owner');
    expect(s.isAuthenticated).toBe(true);
    expect(s.hasBootstrapped).toBe(true);
    expect(s.isLoading).toBe(false);
  });

  it('captures lockout payload (meta.error envelope) on 429', async () => {
    const lockedUntil = new Date(Date.now() + 900_000).toISOString();
    mockedPost.mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          data: null,
          meta: {
            error: { code: 'ACCOUNT_LOCKED', lockedUntil, retryAfterSec: 900 },
          },
        },
      },
    });

    await expect(
      useAuthStore.getState().login({ username: 'owner', password: 'wrong' }),
    ).rejects.toBeDefined();

    const s = useAuthStore.getState();
    expect(s.lockout?.lockedUntil).toBe(lockedUntil);
    expect(s.lockout?.retryAfterSec).toBe(900);
    expect(s.isAuthenticated).toBe(false);
  });

  it('captures lockout payload (flat shape) on 429', async () => {
    const lockedUntil = new Date(Date.now() + 600_000).toISOString();
    mockedPost.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { lockedUntil, retryAfterSec: 600, code: 'ACCOUNT_LOCKED' },
      },
    });

    await expect(
      useAuthStore.getState().login({ username: 'owner', password: 'wrong' }),
    ).rejects.toBeDefined();

    expect(useAuthStore.getState().lockout?.lockedUntil).toBe(lockedUntil);
  });

  it('does NOT set lockout for plain 401', async () => {
    mockedPost.mockRejectedValueOnce({
      response: { status: 401, data: { meta: { error: { message: 'bad creds' } } } },
    });

    await expect(
      useAuthStore.getState().login({ username: 'x', password: 'y' }),
    ).rejects.toBeDefined();

    expect(useAuthStore.getState().lockout).toBeNull();
  });
});

describe('authStore.refresh / bootstrap', () => {
  it('refresh() rehydrates the session on success', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'new.jwt', user: FAKE_USER } },
    });

    const ok = await useAuthStore.getState().refresh();
    expect(ok).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe('new.jwt');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('refresh() clears the session on failure', async () => {
    useAuthStore.setState({ accessToken: 'old', user: FAKE_USER, isAuthenticated: true });
    mockedPost.mockRejectedValueOnce({ response: { status: 401 } });

    const ok = await useAuthStore.getState().refresh();
    expect(ok).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('bootstrap() coalesces concurrent calls into one network request', async () => {
    mockedPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'jwt', user: FAKE_USER } },
    });

    const [a, b, c] = await Promise.all([
      useAuthStore.getState().bootstrap(),
      useAuthStore.getState().bootstrap(),
      useAuthStore.getState().bootstrap(),
    ]);

    // All three resolve to the same (undefined) result.
    expect(a).toBeUndefined();
    expect(b).toBeUndefined();
    expect(c).toBeUndefined();

    // Only ONE refresh round-trip — all three callers shared the promise.
    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().hasBootstrapped).toBe(true);
    expect(useAuthStore.getState().isBootstrapping).toBe(false);
  });

  it('bootstrap() returns immediately if already bootstrapped', async () => {
    useAuthStore.setState({ hasBootstrapped: true });
    await useAuthStore.getState().bootstrap();
    expect(mockedPost).not.toHaveBeenCalled();
  });
});

describe('authStore.logout / changePassword', () => {
  it('logout() clears the session even if the API fails', async () => {
    useAuthStore.setState({ accessToken: 'jwt', user: FAKE_USER, isAuthenticated: true });
    mockedPost.mockRejectedValueOnce(new Error('network down'));

    await useAuthStore.getState().logout();

    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('changePassword() wipes the session on success (forces re-login)', async () => {
    useAuthStore.setState({ accessToken: 'jwt', user: FAKE_USER, isAuthenticated: true });
    mockedPost.mockResolvedValueOnce({ data: { data: { ok: true, revoked: 3 } } });

    await useAuthStore.getState().changePassword({
      currentPassword: 'Old@12345',
      newPassword: 'New@12345',
      confirmPassword: 'New@12345',
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('authStore permission helpers', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: FAKE_USER, isAuthenticated: true });
  });

  it('hasPermission() returns true only for granted codes', () => {
    expect(useAuthStore.getState().hasPermission('users.view')).toBe(true);
    expect(useAuthStore.getState().hasPermission('users.delete')).toBe(false);
  });

  it('hasAnyPermission() matches at least one code', () => {
    expect(useAuthStore.getState().hasAnyPermission(['users.delete', 'users.view'])).toBe(true);
    expect(useAuthStore.getState().hasAnyPermission(['users.delete', 'reports.view'])).toBe(false);
  });

  it('hasAllPermissions() requires every code', () => {
    expect(useAuthStore.getState().hasAllPermissions(['users.view', 'roles.view'])).toBe(true);
    expect(useAuthStore.getState().hasAllPermissions(['users.view', 'users.delete'])).toBe(false);
  });

  it('hasRole() respects the user.roles array', () => {
    expect(useAuthStore.getState().hasRole('Owner')).toBe(true);
    expect(useAuthStore.getState().hasRole('SalesWorker')).toBe(false);
  });

  it('all helpers return false when not authenticated', () => {
    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().hasPermission('x')).toBe(false);
    expect(useAuthStore.getState().hasAnyPermission(['x'])).toBe(false);
    expect(useAuthStore.getState().hasAllPermissions(['x'])).toBe(false);
    expect(useAuthStore.getState().hasRole('Owner')).toBe(false);
  });
});

describe('authStore.clearLockout', () => {
  it('resets the lockout slot', () => {
    useAuthStore.setState({
      lockout: { lockedUntil: new Date().toISOString(), retryAfterSec: 900 },
    });
    useAuthStore.getState().clearLockout();
    expect(useAuthStore.getState().lockout).toBeNull();
  });
});
