import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route as public — JwtAuthGuard will skip authentication.
 *
 * Usage:
 *   @Public()
 *   @Post('login')
 *   login(...) {}
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
