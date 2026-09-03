/**
 * PermissionGate component tests — Phase 2 P2-5.
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PermissionGate } from '@/components/permissions/PermissionGate';
import { useAuthStore } from '@/stores/authStore';

const FAKE_USER = {
  id: 'u-1',
  username: 'sales',
  fullName: 'بائع',
  storeId: 'store-1',
  roles: ['SalesWorker'],
  permissions: ['sales.view', 'sales.create', 'customers.view'],
};

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isBootstrapping: false,
    hasBootstrapped: true,
    isLoading: false,
    lockout: null,
  });
});

function authed() {
  useAuthStore.setState({
    user: FAKE_USER,
    accessToken: 'jwt',
    isAuthenticated: true,
    hasBootstrapped: true,
  });
}

describe('PermissionGate', () => {
  it('renders fallback when unauthenticated', () => {
    render(
      <PermissionGate permission="sales.view" fallback={<span data-testid="fb">no</span>}>
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    expect(screen.queryByTestId('ok')).not.toBeInTheDocument();
  });

  it('renders children when single permission matches', () => {
    authed();
    render(
      <PermissionGate permission="sales.view">
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('hides children when single permission missing', () => {
    authed();
    render(
      <PermissionGate permission="users.view" fallback={<span data-testid="fb">denied</span>}>
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
    expect(screen.queryByTestId('ok')).not.toBeInTheDocument();
  });

  it('anyOf passes when at least one is granted', () => {
    authed();
    render(
      <PermissionGate anyOf={['users.view', 'sales.view']}>
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('anyOf hides when none granted', () => {
    authed();
    render(
      <PermissionGate anyOf={['users.view', 'roles.view']} fallback={<span data-testid="fb" />}>
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
  });

  it('allOf passes only when every code is granted', () => {
    authed();
    render(
      <PermissionGate allOf={['sales.view', 'sales.create']}>
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });

  it('allOf hides when any code is missing', () => {
    authed();
    render(
      <PermissionGate
        allOf={['sales.view', 'users.view']}
        fallback={<span data-testid="fb">denied</span>}
      >
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('fb')).toBeInTheDocument();
  });

  it('legacy `need` alias still works', () => {
    authed();
    render(
      <PermissionGate need="sales.view">
        <span data-testid="ok">yes</span>
      </PermissionGate>,
    );
    expect(screen.getByTestId('ok')).toBeInTheDocument();
  });
});
