import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_ALL_KEY, PERMISSIONS_ANY_KEY } from '../decorators/permissions.decorator';
import type { AuthUser } from '../types/auth-user';

/**
 * Enforces `@RequirePermission(...)` (AND) and `@RequireAnyPermission(...)` (OR)
 * decorators against `request.user.permissions` populated by JwtStrategy.
 *
 * If both decorators are present on the same handler, BOTH constraints must
 * pass (AND first, then ANY).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler();
    const klass = ctx.getClass();

    const requireAll = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_ALL_KEY, [
      handler,
      klass,
    ]);
    const requireAny = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_ANY_KEY, [
      handler,
      klass,
    ]);

    // No metadata → no permission check (auth alone is enough).
    if ((!requireAll || requireAll.length === 0) && (!requireAny || requireAny.length === 0)) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      // Should not reach here if JwtAuthGuard ran, but be defensive.
      throw new ForbiddenException({
        message: 'مطلوب تسجيل الدخول',
        code: 'UNAUTHENTICATED',
      });
    }

    const has = (code: string): boolean => user.permissions.includes(code);

    if (requireAll && requireAll.length > 0) {
      const missing = requireAll.filter((p) => !has(p));
      if (missing.length > 0) {
        throw new ForbiddenException({
          message: 'ليس لديك صلاحية للقيام بهذا الإجراء',
          code: 'PERMISSION_DENIED',
          errors: missing.map((m) => ({ path: ['permission'], message: m })),
        });
      }
    }

    if (requireAny && requireAny.length > 0) {
      const ok = requireAny.some(has);
      if (!ok) {
        throw new ForbiddenException({
          message: 'ليس لديك صلاحية للقيام بهذا الإجراء',
          code: 'PERMISSION_DENIED',
          errors: requireAny.map((m) => ({ path: ['permission'], message: m })),
        });
      }
    }

    return true;
  }
}
