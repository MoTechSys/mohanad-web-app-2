/**
 * Common Zod schemas — تُشارك بين الباكند (DTO validation) والفرونت (form validation).
 */

import { z } from 'zod';
import { LIMITS } from '../constants/index';

// رقم عشري إيجابي بصيغة Decimal(14,2)
export const decimalSchema = (opts?: { min?: number; max?: number; allowZero?: boolean }) =>
  z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === 'string' ? Number(val) : val))
    .refine((n) => Number.isFinite(n), { message: 'يجب أن يكون رقماً صحيحاً' })
    .refine((n) => (opts?.allowZero ? n >= 0 : n > 0), {
      message: opts?.allowZero ? 'يجب أن يكون ≥ 0' : 'يجب أن يكون أكبر من 0',
    })
    .refine((n) => (opts?.min === undefined ? true : n >= opts.min), {
      message: `الحد الأدنى ${opts?.min}`,
    })
    .refine((n) => (opts?.max === undefined ? true : n <= opts.max), {
      message: `الحد الأقصى ${opts?.max}`,
    })
    .refine(
      (n) => {
        // التحقق من عدد الأرقام بعد العلامة العشرية
        const str = n.toString();
        const dotIndex = str.indexOf('.');
        if (dotIndex === -1) return true;
        return str.length - dotIndex - 1 <= LIMITS.DECIMAL_SCALE;
      },
      { message: `الحد الأقصى ${LIMITS.DECIMAL_SCALE} منازل عشرية` },
    );

// CUID validation
export const cuidSchema = z.string().regex(/^c[a-z0-9]{24,}$/, 'معرّف غير صالح');

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(LIMITS.PAGE_SIZE_MAX).default(LIMITS.PAGE_SIZE_DEFAULT),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(50).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// Username & password
export const usernameSchema = z
  .string()
  .trim()
  .min(LIMITS.USERNAME_MIN_LENGTH)
  .max(LIMITS.USERNAME_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_.-]+$/, 'الاسم: حروف إنجليزية وأرقام و _ . - فقط');

export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN_LENGTH, `كلمة المرور ≥ ${LIMITS.PASSWORD_MIN_LENGTH} أحرف`)
  .max(LIMITS.PASSWORD_MAX_LENGTH);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{7,20}$/, 'رقم هاتف غير صالح')
  .optional();

export const arabicNameSchema = z.string().trim().min(1).max(120);
