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
const UsersListPage = lazy(() =>
  import('./pages/admin/UsersListPage').then((m) => ({ default: m.UsersListPage })),
);
const UserDetailPage = lazy(() =>
  import('./pages/admin/UserDetailPage').then((m) => ({ default: m.UserDetailPage })),
);
const RolesListPage = lazy(() =>
  import('./pages/admin/RolesListPage').then((m) => ({ default: m.RolesListPage })),
);
const RoleFormPage = lazy(() =>
  import('./pages/admin/RoleFormPage').then((m) => ({ default: m.RoleFormPage })),
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const CustomersPage = lazy(() =>
  import('./pages/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })),
);
const SalesPage = lazy(() =>
  import('./pages/sales/SalesPage').then((m) => ({ default: m.SalesPage })),
);
const SuppliersPage = lazy(() =>
  import('./pages/suppliers/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);
const PurchasesPage = lazy(() =>
  import('./pages/purchases/PurchasesPage').then((m) => ({ default: m.PurchasesPage })),
);
const ExpensesPage = lazy(() =>
  import('./pages/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
const InventoryPage = lazy(() =>
  import('./pages/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const ReportsPage = lazy(() =>
  import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);

export function AppRoutes(): JSX.Element {
  return (
    <Switch>
      <Route exact path="/" render={() => <Redirect to="/login" />} />
      <Route exact path="/login" component={LoginPage} />
      <ProtectedRoute exact path="/dashboard" component={DashboardPage} />

      {/* Business Modules */}
      <ProtectedRoute
        exact
        path="/customers"
        component={CustomersPage}
        permission="customers.view"
      />
      <ProtectedRoute
        exact
        path="/sales"
        component={SalesPage}
        anyOf={['sales.view', 'sales.create']}
      />
      <ProtectedRoute
        exact
        path="/suppliers"
        component={SuppliersPage}
        permission="suppliers.view"
      />
      <ProtectedRoute
        exact
        path="/purchases"
        component={PurchasesPage}
        permission="purchases.view"
      />
      <ProtectedRoute
        exact
        path="/expenses"
        component={ExpensesPage}
        anyOf={['expenses.view', 'expense_categories.view']}
      />
      <ProtectedRoute
        exact
        path="/inventory"
        component={InventoryPage}
        anyOf={['inventory.view', 'products.view']}
      />
      <ProtectedRoute exact path="/products" component={ProductsPage} permission="products.view" />
      <ProtectedRoute
        exact
        path="/reports"
        component={ReportsPage}
        permission="reports.dashboard.view"
      />
      <ProtectedRoute
        exact
        path="/settings"
        component={SettingsPage}
        permission="system.settings.view"
      />

      {/* Admin */}
      <ProtectedRoute exact path="/admin/users" component={UsersListPage} permission="users.view" />
      <ProtectedRoute
        exact
        path="/admin/users/:id"
        component={UserDetailPage}
        permission="users.view"
      />
      <ProtectedRoute exact path="/admin/roles" component={RolesListPage} permission="roles.view" />
      <ProtectedRoute
        exact
        path="/admin/roles/new"
        component={RoleFormPage}
        permission="roles.create"
      />
      <ProtectedRoute
        exact
        path="/admin/roles/:id"
        component={RoleFormPage}
        permission="roles.view"
      />

      {/* Account */}
      <ProtectedRoute exact path="/account" component={AccountPage} />

      <Route component={NotFoundPage} />
    </Switch>
  );
}
