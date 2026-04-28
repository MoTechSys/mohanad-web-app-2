import { type ComponentType } from 'react';
import { Redirect, Route, type RouteProps } from 'react-router-dom';

import { useAuthStore } from '@/stores/authStore';

/**
 * ProtectedRoute — Phase 2 P2-5.
 *
 *   • While the initial /auth/refresh probe is in-flight (`isBootstrapping`)
 *     we render a loading skeleton so we don't briefly flash the login
 *     page on a hard refresh.
 *   • After bootstrap settles: if not authenticated → redirect to /login,
 *     otherwise render the wrapped route.
 *
 * Bootstrap is fired once at the App root by `HttpBridge`, so we just
 * read the flag here.
 */
interface ProtectedRouteProps extends Omit<RouteProps, 'component' | 'render'> {
  // biome-ignore lint/suspicious/noExplicitAny: route components accept the v5 RouteComponentProps which we forward unmodified
  component: ComponentType<any>;
}

export function ProtectedRoute({
  component: Component,
  ...rest
}: ProtectedRouteProps): JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

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
        return <Component {...props} />;
      }}
    />
  );
}
