import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';

/**
 * Phase 2 P2-6 — Admin API client.
 *
 * Thin, typed wrappers over the `apiX` helpers (which themselves unwrap the
 * standard `{ data, meta }` envelope). All endpoints sit under `/api/v1`.
 *
 * Hooks (TanStack Query) are exposed by `./hooks.ts`.
 */

// ─── Types (mirror the NestJS service responses) ────────────────────────

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  isSystem?: boolean;
}

export interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: RoleSummary[];
}

export interface UserDetail extends UserListItem {
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  updatedAt?: string;
  roles: (RoleSummary & { assignedAt?: string })[];
}

export interface PaginatedUsers {
  items: UserListItem[];
  meta: { page: number; limit: number; total: number; totalPages?: number };
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  roleId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface CreateUserBody {
  username: string;
  password: string;
  fullName: string;
  phone?: string;
  isActive?: boolean;
  roleIds: string[];
}

export interface UpdateUserBody {
  fullName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface RoleListItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  /** Backend returns `permissionsCount` (plural). */
  permissionsCount?: number;
  /** Backend returns `usersCount` (plural). */
  usersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleDetail extends RoleListItem {
  permissions: { key: string; name: string; module: string }[];
  /** Some role endpoints additionally return the codes array. */
  permissionCodes?: string[];
}

export interface CreateRoleBody {
  key: string;
  name: string;
  description?: string;
  permissionCodes: string[];
}

export interface UpdateRoleBody {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface PermissionCatalogItem {
  key: string;
  name: string;
  module: string;
  description: string | null;
}

export interface PermissionCatalog {
  items: PermissionCatalogItem[];
  groups: { module: string; permissions: PermissionCatalogItem[] }[];
  total: number;
}

// ─── Users ──────────────────────────────────────────────────────────────

export const UsersApi = {
  list: (params: ListUsersParams = {}): Promise<PaginatedUsers> =>
    apiGet<PaginatedUsers>('/api/v1/users', { params }),
  get: (id: string): Promise<UserDetail> => apiGet<UserDetail>(`/api/v1/users/${id}`),
  effectivePermissions: (id: string): Promise<{ userId: string; permissions: string[] }> =>
    apiGet<{ userId: string; permissions: string[] }>(`/api/v1/users/${id}/effective-permissions`),
  create: (body: CreateUserBody): Promise<UserDetail> =>
    apiPost<UserDetail, CreateUserBody>('/api/v1/users', body),
  update: (id: string, body: UpdateUserBody): Promise<UserDetail> =>
    apiPatch<UserDetail, UpdateUserBody>(`/api/v1/users/${id}`, body),
  activate: (id: string): Promise<UserDetail> =>
    apiPost<UserDetail, undefined>(`/api/v1/users/${id}/activate`),
  deactivate: (id: string): Promise<{ ok: boolean; refreshTokensRevoked?: number }> =>
    apiPost<{ ok: boolean; refreshTokensRevoked?: number }, undefined>(
      `/api/v1/users/${id}/deactivate`,
    ),
  resetPassword: (id: string, newPassword: string): Promise<{ ok: boolean }> =>
    apiPost<{ ok: boolean }, { newPassword: string }>(`/api/v1/users/${id}/reset-password`, {
      newPassword,
    }),
  assignRoles: (id: string, roleIds: string[]): Promise<UserDetail> =>
    apiPost<UserDetail, { roleIds: string[] }>(`/api/v1/users/${id}/roles`, { roleIds }),
  remove: (id: string): Promise<{ ok: boolean }> =>
    apiDelete<{ ok: boolean }>(`/api/v1/users/${id}`),
};

// ─── Roles ──────────────────────────────────────────────────────────────

export const RolesApi = {
  list: async (): Promise<RoleListItem[]> => {
    // Backend returns `{ items: [...] }` (paginated-style envelope inside `data`).
    const res = await apiGet<RoleListItem[] | { items: RoleListItem[] }>('/api/v1/roles');
    return Array.isArray(res) ? res : res.items;
  },
  get: (id: string): Promise<RoleDetail> => apiGet<RoleDetail>(`/api/v1/roles/${id}`),
  create: (body: CreateRoleBody): Promise<RoleDetail> =>
    apiPost<RoleDetail, CreateRoleBody>('/api/v1/roles', body),
  update: (id: string, body: UpdateRoleBody): Promise<RoleDetail> =>
    apiPatch<RoleDetail, UpdateRoleBody>(`/api/v1/roles/${id}`, body),
  setPermissions: (id: string, permissionCodes: string[]): Promise<RoleDetail> =>
    apiPut<RoleDetail, { permissionCodes: string[] }>(`/api/v1/roles/${id}/permissions`, {
      permissionCodes,
    }),
  clone: (sourceRoleId: string, key: string, name: string, description?: string) =>
    apiPost<RoleDetail, { sourceRoleId: string; key: string; name: string; description?: string }>(
      '/api/v1/roles/clone',
      { sourceRoleId, key, name, description },
    ),
  remove: (id: string): Promise<{ ok: boolean }> =>
    apiDelete<{ ok: boolean }>(`/api/v1/roles/${id}`),
};

// ─── Permissions catalog ────────────────────────────────────────────────

export const PermissionsApi = {
  list: (): Promise<PermissionCatalog> => apiGet<PermissionCatalog>('/api/v1/permissions'),
};
