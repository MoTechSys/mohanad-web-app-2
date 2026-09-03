import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_ALL_KEY = 'permissions:all';
export const PERMISSIONS_ANY_KEY = 'permissions:any';

/**
 * Require ALL listed permissions (AND).
 *
 * Usage:
 *   @RequirePermission('users.view')
 *   @RequirePermission('users.create', 'users.update')
 */
export const RequirePermission = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_ALL_KEY, permissions);

/**
 * Require ANY listed permission (OR).
 *
 * Usage:
 *   @RequireAnyPermission('users.view', 'users.view_self')
 */
export const RequireAnyPermission = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
