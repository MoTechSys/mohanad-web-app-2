/**
 * Roles RBAC schemas — مشاركة بين الفرونت (RHF) والباكند (validation pipe).
 *
 * Phase 2: full CRUD + permission editing + cloning.
 * System roles (isSystem=true) are protected: name & key cannot be changed,
 * cannot be deleted; only their permission set may be edited.
 */

import { z } from 'zod';
import { cuidSchema } from './common';

// ─── Permission code (e.g. "users.view") ─────────────────────
const permissionCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, 'صيغة الصلاحية: module.action');

// ─── Role name & key ─────────────────────────────────────────
const roleKeySchema = z
  .string()
  .trim()
  .min(2)
  .max(50)
  .regex(/^[a-z][a-z0-9_-]*$/, 'مفتاح الدور: حروف صغيرة وأرقام و _ - فقط');

const roleNameSchema = z.string().trim().min(2).max(80);

// ─── Create role ─────────────────────────────────────────────
export const createRoleSchema = z.object({
  key: roleKeySchema,
  name: roleNameSchema,
  description: z.string().trim().max(255).optional(),
  permissionCodes: z.array(permissionCodeSchema).default([]),
});
export type CreateRoleInput = z.infer<typeof createRoleSchema>;

// ─── Update role (system roles can only update permissions/description) ──
export const updateRoleSchema = z.object({
  name: roleNameSchema.optional(),
  description: z.string().trim().max(255).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// ─── Set permissions on a role (replace) ─────────────────────
export const setPermissionsSchema = z.object({
  permissionCodes: z.array(permissionCodeSchema),
});
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;

// ─── Clone role ──────────────────────────────────────────────
export const cloneRoleSchema = z.object({
  sourceRoleId: cuidSchema,
  key: roleKeySchema,
  name: roleNameSchema,
  description: z.string().trim().max(255).optional(),
});
export type CloneRoleInput = z.infer<typeof cloneRoleSchema>;
