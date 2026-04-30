import type {
  CloneRoleInput,
  CreateRoleInput,
  SetPermissionsInput,
  UpdateRoleInput,
} from '@grocery/shared';

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';

/** Roles + Permissions API wrappers (Phase 2 P2-6). */

export interface RoleSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionsCount: number;
  usersCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleDetail extends RoleSummary {
  permissions: { key: string; name: string; module: string; description: string | null }[];
}

export interface PermissionsCatalogItem {
  key: string;
  name: string;
  module: string;
  description: string | null;
}

export interface PermissionsCatalogGroup {
  module: string;
  permissions: PermissionsCatalogItem[];
}

export interface PermissionsCatalogResponse {
  items: PermissionsCatalogItem[];
  groups: PermissionsCatalogGroup[];
  total: number;
}

const ROLES_BASE = '/api/v1/roles';
const PERMISSIONS_BASE = '/api/v1/permissions';

/** GET /roles — list with permissions/users counts. */
export function listRoles(): Promise<RoleSummary[] | { items: RoleSummary[] }> {
  return apiGet<RoleSummary[] | { items: RoleSummary[] }>(ROLES_BASE);
}

/** Helper: normalise the list shape (some controllers wrap in `items`). */
export async function listRolesNormalized(): Promise<RoleSummary[]> {
  const res = await listRoles();
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

/** GET /roles/:id — detail incl. assigned permissions. */
export function getRole(id: string): Promise<RoleDetail> {
  return apiGet<RoleDetail>(`${ROLES_BASE}/${id}`);
}

/** POST /roles — create new role + initial permissions. */
export function createRole(body: CreateRoleInput): Promise<RoleDetail> {
  return apiPost<RoleDetail, CreateRoleInput>(ROLES_BASE, body);
}

/** PATCH /roles/:id — update name/description/active. */
export function updateRole(id: string, body: UpdateRoleInput): Promise<RoleDetail> {
  return apiPatch<RoleDetail, UpdateRoleInput>(`${ROLES_BASE}/${id}`, body);
}

/** PUT /roles/:id/permissions — replace permission set. */
export function setRolePermissions(id: string, body: SetPermissionsInput): Promise<RoleDetail> {
  return apiPut<RoleDetail, SetPermissionsInput>(`${ROLES_BASE}/${id}/permissions`, body);
}

/** POST /roles/clone — duplicate a role with new key/name. */
export function cloneRole(body: CloneRoleInput): Promise<RoleDetail> {
  return apiPost<RoleDetail, CloneRoleInput>(`${ROLES_BASE}/clone`, body);
}

/** DELETE /roles/:id — non-system roles only. */
export function deleteRole(id: string): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`${ROLES_BASE}/${id}`);
}

/** GET /permissions — full catalog (grouped). */
export function getPermissionsCatalog(): Promise<PermissionsCatalogResponse> {
  return apiGet<PermissionsCatalogResponse>(PERMISSIONS_BASE);
}
