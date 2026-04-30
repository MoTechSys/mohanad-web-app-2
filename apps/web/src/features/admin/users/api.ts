import type {
  AssignRolesInput,
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
} from '@grocery/shared';

import { type PaginationMeta, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';

/**
 * Users API — thin TanStack-Query–friendly wrappers around `/api/v1/users`.
 *
 * The backend wraps successful responses in `{ data, meta }`; the helpers in
 * `lib/api.ts` already unwrap that envelope, so call-sites get plain payloads.
 */

export interface UserRoleSummary {
  id: string;
  key: string;
  name: string;
  isSystem?: boolean;
  assignedAt?: string;
}

export interface UserListItem {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: UserRoleSummary[];
}

export interface UserDetail extends UserListItem {
  failedLoginAttempts?: number;
  lockedUntil?: string | null;
  updatedAt?: string;
}

export interface UsersListResponse {
  items: UserListItem[];
  meta: PaginationMeta;
}

export interface EffectivePermissionsResponse {
  userId: string;
  permissions: string[];
}

const USERS_BASE = '/api/v1/users';

/** GET /users (search + filter + pagination). */
export function listUsers(query: Partial<ListUsersQuery> = {}): Promise<UsersListResponse> {
  return apiGet<UsersListResponse>(USERS_BASE, { params: query });
}

/** GET /users/:id (full detail with assigned roles). */
export function getUser(id: string): Promise<UserDetail> {
  return apiGet<UserDetail>(`${USERS_BASE}/${id}`);
}

/** GET /users/:id/effective-permissions — union of permissions across all roles. */
export function getEffectivePermissions(id: string): Promise<EffectivePermissionsResponse> {
  return apiGet<EffectivePermissionsResponse>(`${USERS_BASE}/${id}/effective-permissions`);
}

/** POST /users — create + assign roles in one call. */
export function createUser(body: CreateUserInput): Promise<UserDetail> {
  return apiPost<UserDetail, CreateUserInput>(USERS_BASE, body);
}

/** PATCH /users/:id — update profile (no password). */
export function updateUser(id: string, body: UpdateUserInput): Promise<UserDetail> {
  return apiPatch<UserDetail, UpdateUserInput>(`${USERS_BASE}/${id}`, body);
}

/** POST /users/:id/activate — re-enable login. */
export function activateUser(id: string): Promise<UserDetail> {
  return apiPost<UserDetail>(`${USERS_BASE}/${id}/activate`);
}

/** POST /users/:id/deactivate — disable login + revoke all sessions. */
export function deactivateUser(id: string): Promise<{ ok: true; refreshTokensRevoked: number }> {
  return apiPost<{ ok: true; refreshTokensRevoked: number }>(`${USERS_BASE}/${id}/deactivate`);
}

/** POST /users/:id/reset-password — admin reset (revokes sessions). */
export function resetUserPassword(
  id: string,
  body: ResetPasswordInput,
): Promise<{ ok: true; refreshTokensRevoked: number }> {
  return apiPost<{ ok: true; refreshTokensRevoked: number }, ResetPasswordInput>(
    `${USERS_BASE}/${id}/reset-password`,
    body,
  );
}

/** POST /users/:id/roles — replace assigned roles. */
export function assignUserRoles(id: string, body: AssignRolesInput): Promise<UserDetail> {
  return apiPost<UserDetail, AssignRolesInput>(`${USERS_BASE}/${id}/roles`, body);
}

/** DELETE /users/:id — soft delete (revokes sessions). */
export function deleteUser(id: string): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`${USERS_BASE}/${id}`);
}
