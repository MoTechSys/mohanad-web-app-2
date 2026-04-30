import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CreateRoleBody,
  type CreateUserBody,
  type ListUsersParams,
  PermissionsApi,
  RolesApi,
  type UpdateRoleBody,
  type UpdateUserBody,
  UsersApi,
} from './api';

/**
 * Phase 2 P2-6 — TanStack Query hooks for the admin module.
 *
 * Centralised so the cache keys stay consistent and we can invalidate
 * cleanly after mutations.
 */

// ─── Cache keys ─────────────────────────────────────────────────────────

export const adminKeys = {
  users: {
    all: ['admin', 'users'] as const,
    list: (params: ListUsersParams) => ['admin', 'users', 'list', params] as const,
    detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    permissions: (id: string) => ['admin', 'users', 'permissions', id] as const,
  },
  roles: {
    all: ['admin', 'roles'] as const,
    list: ['admin', 'roles', 'list'] as const,
    detail: (id: string) => ['admin', 'roles', 'detail', id] as const,
  },
  permissionCatalog: ['admin', 'permissions', 'catalog'] as const,
};

// ─── Users ──────────────────────────────────────────────────────────────

export function useUsersListQuery(params: ListUsersParams) {
  return useQuery({
    queryKey: adminKeys.users.list(params),
    queryFn: () => UsersApi.list(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page during navigation
  });
}

export function useUserDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.users.detail(id ?? ''),
    queryFn: () => UsersApi.get(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useUserEffectivePermissionsQuery(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.users.permissions(id ?? ''),
    queryFn: () => UsersApi.effectivePermissions(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => UsersApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all }),
  });
}

export function useUpdateUserMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateUserBody) => UsersApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users.all });
      qc.invalidateQueries({ queryKey: adminKeys.users.detail(id) });
    },
  });
}

export function useActivateUserMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => UsersApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users.all });
      qc.invalidateQueries({ queryKey: adminKeys.users.detail(id) });
    },
  });
}

export function useDeactivateUserMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => UsersApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users.all });
      qc.invalidateQueries({ queryKey: adminKeys.users.detail(id) });
    },
  });
}

export function useResetPasswordMutation(id: string) {
  return useMutation({
    mutationFn: (newPassword: string) => UsersApi.resetPassword(id, newPassword),
  });
}

export function useAssignRolesMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleIds: string[]) => UsersApi.assignRoles(id, roleIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users.all });
      qc.invalidateQueries({ queryKey: adminKeys.users.detail(id) });
      qc.invalidateQueries({ queryKey: adminKeys.users.permissions(id) });
    },
  });
}

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => UsersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users.all }),
  });
}

// ─── Roles ──────────────────────────────────────────────────────────────

export function useRolesListQuery() {
  return useQuery({
    queryKey: adminKeys.roles.list,
    queryFn: () => RolesApi.list(),
    staleTime: 30_000,
  });
}

export function useRoleDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.roles.detail(id ?? ''),
    queryFn: () => RolesApi.get(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useCreateRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateRoleBody) => RolesApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.roles.all }),
  });
}

export function useUpdateRoleMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRoleBody) => RolesApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.roles.all });
      qc.invalidateQueries({ queryKey: adminKeys.roles.detail(id) });
    },
  });
}

export function useSetRolePermissionsMutation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (permissionCodes: string[]) => RolesApi.setPermissions(id, permissionCodes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.roles.all });
      qc.invalidateQueries({ queryKey: adminKeys.roles.detail(id) });
    },
  });
}

export function useDeleteRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => RolesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.roles.all }),
  });
}

// ─── Permissions catalog (static-ish) ───────────────────────────────────

export function usePermissionsCatalogQuery() {
  return useQuery({
    queryKey: adminKeys.permissionCatalog,
    queryFn: () => PermissionsApi.list(),
    staleTime: 5 * 60_000, // catalog is seeded data — rarely changes
  });
}
