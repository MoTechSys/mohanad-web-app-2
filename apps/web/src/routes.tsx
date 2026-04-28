import { lazy } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);

/**
 * Application routes (React Router v5 — Q4 keeps v5 due to Ionic 8 lock).
 *
 *   /          → redirect to /login
 *   /login     → LoginPage (public)
 *   /dashboard → DashboardPage (auth required)
 *   *          → NotFoundPage (404)
 */
export function AppRoutes(): JSX.Element {
  return (
    <Switch>
      <Route exact path="/" render={() => <Redirect to="/login" />} />
      <Route exact path="/login" component={LoginPage} />
      <ProtectedRoute exact path="/dashboard" component={DashboardPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
