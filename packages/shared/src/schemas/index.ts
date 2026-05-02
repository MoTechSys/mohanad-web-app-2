/**
 * Zod Schemas مشتركة بين الفرونت (نماذج RHF) والباكند (validation pipes).
 *
 * Phase 2 — تُصدَّر جميع المخططات من ملفاتها المنفصلة:
 *   - common.ts  → decimalSchema, paginationSchema, passwordSchema, …
 *   - auth.ts    → loginSchema, refreshTokenSchema, changePasswordSchema
 *
 * تستمر بقية المخططات (sales, customers, …) في الإضافة في Phases لاحقة.
 */

export * from './auth';
export * from './common';
export * from './customers';
export * from './notifications';
export * from './roles';
export * from './users';

// ─── Money (legacy — تستخدم في الفرونت) ──────────
import { z } from 'zod';

/**
 * مبلغ مالي (Decimal(14,2)) — يُمرَّر كرقم في الـ JSON.
 * لا قيود سالبة لأن adjustment قد يكون سالباً.
 */
export const moneySchema = z
  .number({ invalid_type_error: 'يجب أن يكون رقماً' })
  .finite()
  .multipleOf(0.01, 'الكسور بحد أقصى رقمين عشريين');

export const positiveMoneySchema = moneySchema.positive('يجب أن يكون أكبر من صفر');
export * from './suppliers';
export * from './purchases';
export * from './sales';
export * from './daily-income';
export * from './inventory';
