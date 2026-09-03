import { ShieldX } from 'lucide-react';
import { type ComponentType } from 'react';
import { Link, Redirect, Route, type RouteProps } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';

/**
 * ProtectedRoute — Phase 2 P2-5 (auth gate) + P2-6 (permission gate).
 *
 *   • While the initial /auth/refresh probe is in-flight (`isBootstrapping`)
 *     we render a loading skeleton so we don't briefly flash the login
 *     page on a hard refresh.
 *   • After bootstrap settles:
 *       - not authenticated     → redirect to /login (with `from` state)
 *       - authenticated, but    → render the "permission denied" panel
 *         missing required perm
 *       - otherwise             → render the wrapped page component
 *
 * Bootstrap is fired once at the App root by `AppBootstrap`.
 *
 * Permission semantics mirror `<PermissionGate>`:
 *   - `permission`  single code that must be present
 *   - `anyOf`       at least one of the listed codes
 *   - `allOf`       all of the listed codes
 *
 * If multiple are supplied they are combined via logical AND.
 */
interface ProtectedRouteProps extends Omit<RouteProps, 'component' | 'render'> {
  // biome-ignore lint/suspicious/noExplicitAny: route components accept the v5 RouteComponentProps which we forward unmodified
  component: ComponentType<any>;
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
}

export function ProtectedRoute({
  component: Component,
  permission,
  anyOf,
  allOf,
  ...rest
}: ProtectedRouteProps): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);
  const hasAllPermissions = useAuthStore((s) => s.hasAllPermissions);

  return (
    <Route
      {...rest}
      render={(props) => {
        if (isBootstrapping) {
          return (
            <div
              role="status"
              aria-live="polite"
              className="grid place-items-center min-h-screen bg-gradient-emerald"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin" />
                <span className="text-sm text-primary-900/70">جاري التحقق من الجلسة…</span>
              </div>
            </div>
          );
        }
        if (!isAuthenticated) {
          return <Redirect to={{ pathname: '/login', state: { from: props.location } }} />;
        }
        const allowed =
          (permission ? hasPermission(permission) : true) &&
          (anyOf ? hasAnyPermission(anyOf) : true) &&
          (allOf ? hasAllPermissions(allOf) : true);
        if (!allowed)
          return <PermissionDenied requiredCode={permission ?? anyOf?.[0] ?? allOf?.[0]} />;
        return <Component {...props} />;
      }}
    />
  );
}

function PermissionDenied({ requiredCode }: { requiredCode?: string }): JSX.Element {
  return (
    <div className="grid place-items-center min-h-screen bg-surface-alt px-4">
      <div className="max-w-md text-center space-y-3">
        <div className="mx-auto grid place-items-center h-14 w-14 rounded-2xl bg-red-50 text-red-600">
          <ShieldX className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-ink">لا تملك صلاحية الوصول</h1>
        <p className="text-sm text-gray-600">
          هذه الصفحة تتطلب صلاحية إضافية. تواصل مع مالك المتجر إن كنت بحاجة للوصول.
        </p>
        {requiredCode ? (
          <p className="text-xs text-gray-400">
            الصلاحية المطلوبة:{' '}
            <code dir="ltr" className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {requiredCode}
            </code>
          </p>
        ) : null}
        <Link
          to="/dashboard"
          className="inline-block mt-2 text-sm text-primary-700 hover:text-primary-800 hover:underline"
        >
          الرجوع إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}
