/**
 * Zod Schemas مشتركة بين الفرونت (نماذج RHF) والباكند (validation pipes).
 *
 * في Foundation نُعرّف فقط ما يلزم لـ Auth + Health،
 * وستُضاف بقية الـ schemas في المراحل التالية.
 */

import { z } from 'zod';

// ─── Auth ────────────────────────────────────────
export const loginSchema = z.object({
  username: z
    .string({ required_error: 'اسم المستخدم مطلوب' })
    .trim()
    .min(3, 'اسم المستخدم 3 أحرف على الأقل')
    .max(50, 'اسم المستخدم طويل جداً'),
  password: z
    .string({ required_error: 'كلمة المرور مطلوبة' })
    .min(6, 'كلمة المرور 6 أحرف على الأقل')
    .max(128, 'كلمة المرور طويلة جداً'),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Pagination ─────────────────────────────────
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().trim().optional(),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── Money ──────────────────────────────────────
/**
 * مبلغ مالي (Decimal(14,2)) — يُمرَّر كرقم في الـ JSON.
 * لا قيود سالبة لأن adjustment قد يكون سالباً.
 */
export const moneySchema = z
  .number({ invalid_type_error: 'يجب أن يكون رقماً' })
  .finite()
  .multipleOf(0.01, 'الكسور بحد أقصى رقمين عشريين');

export const positiveMoneySchema = moneySchema.positive('يجب أن يكون أكبر من صفر');
