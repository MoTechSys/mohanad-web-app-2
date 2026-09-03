/**
 * Users RBAC schemas — مشاركة بين الفرونت (RHF) والباكند (validation pipe).
 *
 * Phase 2: full CRUD + role assignment + password reset.
 */

import { z } from 'zod';
import {
  arabicNameSchema,
  cuidSchema,
  paginationSchema,
  passwordSchema,
  phoneSchema,
  usernameSchema,
} from './common';

// ─── Create user ─────────────────────────────────────────────
export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  fullName: arabicNameSchema,
  phone: phoneSchema,
  isActive: z.boolean().default(true),
  roleIds: z.array(cuidSchema).min(1, 'يجب تعيين دور واحد على الأقل'),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// ─── Update user (no password — separate endpoint) ──────────
export const updateUserSchema = z.object({
  fullName: arabicNameSchema.optional(),
  phone: phoneSchema,
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─── Reset password (admin) ─────────────────────────────────
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Assign roles ───────────────────────────────────────────
export const assignRolesSchema = z.object({
  roleIds: z.array(cuidSchema).min(1, 'يجب تعيين دور واحد على الأقل'),
});
export type AssignRolesInput = z.infer<typeof assignRolesSchema>;

// ─── List users query ───────────────────────────────────────
export const listUsersQuerySchema = paginationSchema.extend({
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  roleId: cuidSchema.optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
