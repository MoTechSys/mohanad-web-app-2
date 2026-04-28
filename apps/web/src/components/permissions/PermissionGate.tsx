import { type ReactNode } from 'react';

import { useAuthStore } from '@/stores/authStore';

/**
 * PermissionGate — Phase 2 P2-5 RBAC visibility wrapper.
 *
 * Mirrors the backend `PermissionsGuard`:
 *   • `permission` — single code that MUST be present.
 *   • `allOf`     — every code must be present.
 *   • `anyOf`     — at least one code is sufficient.
 *
 * If multiple props are supplied they are combined with logical AND.
 * If none of them are supplied, the children render as long as the
 * user is authenticated.
 *
 * Behavior when not authenticated: renders nothing (vs. the older
 * Foundation default which rendered children for design previews).
 *
 *   <PermissionGate permission="customers.create">
 *     <Button>إضافة عميل</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={['sales.view', 'sales.create']}>
 *     <SalesWidget />
 *   </PermissionGate>
 */
export interface PermissionGateProps {
  /** Single permission code that must be present. */
  permission?: string;
  /** ALL of the listed codes must be present. */
  allOf?: string[];
  /** ANY of the listed codes is sufficient. */
  anyOf?: string[];
  /** @deprecated use `permission` */
  need?: string;
  /** @deprecated use `allOf` */
  all?: string[];
  /** @deprecated use `anyOf` */
  any?: string[];
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  allOf,
  anyOf,
  need,
  all,
  any,
  fallback = null,
  children,
}: PermissionGateProps): JSX.Element {
  const { isAuthenticated, hasPermission, hasAnyPermission, hasAllPermissions } = useAuthStore();

  if (!isAuthenticated) return <>{fallback}</>;

  const single = permission ?? need;
  const allList = allOf ?? all;
  const anyList = anyOf ?? any;

  const ok =
    (single ? hasPermission(single) : true) &&
    (allList ? hasAllPermissions(allList) : true) &&
    (anyList ? hasAnyPermission(anyList) : true);

  return <>{ok ? children : fallback}</>;
}
