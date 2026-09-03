import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user';

/**
 * Injects `request.user` (populated by JwtAuthGuard) into a controller method.
 *
 * Usage:
 *   @Get('me')
 *   me(@CurrentUser() user: AuthUser) { … }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return req.user;
  },
);
