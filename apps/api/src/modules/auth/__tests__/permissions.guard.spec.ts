/**
 * PermissionsGuard — Jest spec.
 *
 * Validates @RequirePermission (AND) and @RequireAnyPermission (OR) behavior,
 * plus the no-metadata pass-through and missing-user defense.
 */

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_ALL_KEY, PERMISSIONS_ANY_KEY } from '../decorators/permissions.decorator';
import { PermissionsGuard } from '../guards/permissions.guard';
import type { AuthUser } from '../types/auth-user';

const buildCtx = (
  user: Partial<AuthUser> | null,
  metaAll?: string[],
  metaAny?: string[],
): ExecutionContext => {
  const reflectorValues = new Map<string, unknown>();
  if (metaAll) reflectorValues.set(PERMISSIONS_ALL_KEY, metaAll);
  if (metaAny) reflectorValues.set(PERMISSIONS_ANY_KEY, metaAny);

  // We don't really pass through the reflector; we set metadata via Reflect on the handler.
  const handler = function noop() {};
  // biome-ignore lint/complexity/noBannedTypes: NestJS Reflector typing requires Function-like.
  const klass = function NoopController() {} as unknown as Function;
  if (metaAll) Reflect.defineMetadata(PERMISSIONS_ALL_KEY, metaAll, handler);
  if (metaAny) Reflect.defineMetadata(PERMISSIONS_ANY_KEY, metaAny, handler);

  return {
    getHandler: () => handler as never,
    getClass: () => klass as never,
    switchToHttp: () => ({
      getRequest: () => ({ user: user ?? undefined }),
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext;
};

const buildUser = (perms: string[]): AuthUser => ({
  id: 'u-1',
  username: 'tester',
  fullName: 'Tester',
  storeId: 's-1',
  permissions: perms,
  roles: ['Tester'],
});

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = new PermissionsGuard(new Reflector());
  });

  it('returns true when no permission metadata is set', () => {
    const ctx = buildCtx(buildUser([]));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UNAUTHENTICATED when metadata exists but no user is attached', () => {
    const ctx = buildCtx(null, ['users.view']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    try {
      guard.canActivate(ctx);
    } catch (e) {
      expect((e as ForbiddenException).getResponse()).toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    }
  });

  // ─── @RequirePermission (AND) ──────────────────────────────
  describe('@RequirePermission (AND)', () => {
    it('passes when user has all required permissions', () => {
      const ctx = buildCtx(buildUser(['users.view', 'users.create']), [
        'users.view',
        'users.create',
      ]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws PERMISSION_DENIED with missing list when ANY permission is missing', () => {
      const ctx = buildCtx(buildUser(['users.view']), ['users.view', 'users.create']);
      try {
        guard.canActivate(ctx);
        fail('expected ForbiddenException');
      } catch (e) {
        const res = (e as ForbiddenException).getResponse() as Record<string, unknown>;
        expect(res.code).toBe('PERMISSION_DENIED');
        expect((res.errors as Array<{ message: string }>).map((x) => x.message)).toEqual([
          'users.create',
        ]);
      }
    });
  });

  // ─── @RequireAnyPermission (OR) ────────────────────────────
  describe('@RequireAnyPermission (OR)', () => {
    it('passes when user has at least one of the listed permissions', () => {
      const ctx = buildCtx(buildUser(['roles.view']), undefined, [
        'permissions.view',
        'roles.view_permissions',
        'roles.view',
      ]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('throws PERMISSION_DENIED listing all alternatives when none match', () => {
      const ctx = buildCtx(buildUser(['sales.view']), undefined, ['users.view', 'roles.view']);
      try {
        guard.canActivate(ctx);
        fail('expected ForbiddenException');
      } catch (e) {
        const res = (e as ForbiddenException).getResponse() as Record<string, unknown>;
        expect(res.code).toBe('PERMISSION_DENIED');
        expect((res.errors as Array<{ message: string }>).map((x) => x.message)).toEqual([
          'users.view',
          'roles.view',
        ]);
      }
    });
  });

  // ─── Combined AND + OR ─────────────────────────────────────
  it('enforces both AND and OR when both decorators are present', () => {
    const ctx = buildCtx(
      buildUser(['users.view', 'roles.view']),
      ['users.view'],
      ['roles.view', 'permissions.view'],
    );
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('AND failure short-circuits before checking OR', () => {
    const ctx = buildCtx(buildUser(['roles.view']), ['users.view'], ['roles.view']);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
