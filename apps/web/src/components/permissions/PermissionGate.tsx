import { type ReactNode } from 'react';

import { useAuthStore } from '@/stores/authStore';

/**
 * PermissionGate — RBAC visibility wrapper (Foundation placeholder).
 *
 * Real RBAC enforcement (matching the backend `PermissionGuard`) ships in
 * Phase 2. The Foundation version reads from the in-memory Zustand store and
 * gracefully assumes "show everything" while the user has not authenticated
 * yet, so designers can preview every page during recovery.
 *
 *   <PermissionGate need="customers.create">
 *     <Button>إضافة عميل</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate any={['sales.view', 'sales.create']}>
 *     <SalesWidget />
 *   </PermissionGate>
 */
export interface PermissionGateProps {
  /** Single permission code that must be present. */
  need?: string;
  /** ALL of the listed codes must be present. */
  all?: string[];
  /** ANY of the listed codes is sufficient. */
  any?: string[];
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  need,
  all,
  any,
  fallback = null,
  children,
}: PermissionGateProps): JSX.Element {
  const { isAuthenticated, user } = useAuthStore();

  // Foundation behaviour: when nobody is logged in yet, render children so
  // designers can audit pages. Phase 2 will flip this default.
  if (!isAuthenticated || !user) return <>{children}</>;

  const perms = new Set(user.permissions);
  const ok =
    (need ? perms.has(need) : true) &&
    (all ? all.every((p) => perms.has(p)) : true) &&
    (any ? any.some((p) => perms.has(p)) : true);

  return <>{ok ? children : fallback}</>;
}
