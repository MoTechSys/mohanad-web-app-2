import { lazy } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';

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
 *   /login     → LoginPage
 *   /dashboard → DashboardPage (auth required in Phase 2)
 *   *          → NotFoundPage (404)
 */
export function AppRoutes(): JSX.Element {
  return (
    <Switch>
      <Route exact path="/" render={() => <Redirect to="/login" />} />
      <Route exact path="/login" component={LoginPage} />
      <Route exact path="/dashboard" component={DashboardPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}
