/**
 * Customers + Customer Transactions schemas (Phase 3).
 *
 * تُشارك بين الباكند (NestJS validation pipes) والفرونت (RHF + zodResolver).
 *
 * المرجع: docs/04-rbac-permissions.md (4.4, 4.5) و prisma/schema.prisma.
 */

import { z } from 'zod';
import {
  arabicNameSchema,
  cuidSchema,
  decimalSchema,
  paginationSchema,
  phoneSchema,
} from './common';

// ─── Enums (from Prisma) ────────────────────────────────────
export const customerStatusEnum = z.enum(['ACTIVE', 'FROZEN', 'GRACE_PERIOD']);
export type CustomerStatusZ = z.infer<typeof customerStatusEnum>;

export const customerTransactionTypeEnum = z.enum(['DEBT', 'PAYMENT', 'ADJUSTMENT', 'OPENING']);
export type CustomerTransactionTypeZ = z.infer<typeof customerTransactionTypeEnum>;

// ─── Create customer ─────────────────────────────────────────
export const createCustomerSchema = z.object({
  name: arabicNameSchema,
  phone: phoneSchema,
  whatsappPhone: phoneSchema,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  openingBalance: decimalSchema({ allowZero: true }).default(0),
  creditLimit: decimalSchema({ allowZero: true }).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// ─── Update customer ─────────────────────────────────────────
export const updateCustomerSchema = z.object({
  name: arabicNameSchema.optional(),
  phone: phoneSchema,
  whatsappPhone: phoneSchema,
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ─── Set credit limit ────────────────────────────────────────
export const setCreditLimitSchema = z.object({
  creditLimit: decimalSchema({ allowZero: true }).nullable(),
});
export type SetCreditLimitInput = z.infer<typeof setCreditLimitSchema>;

// ─── Grant grace period ──────────────────────────────────────
export const grantGraceSchema = z.object({
  graceUntil: z.coerce.date(),
});
export type GrantGraceInput = z.infer<typeof grantGraceSchema>;

// ─── List query ──────────────────────────────────────────────
export const listCustomersQuerySchema = paginationSchema.extend({
  status: customerStatusEnum.optional(),
  hasDebt: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
});
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

// ─── Customer transactions ───────────────────────────────────
export const createDebtSchema = z.object({
  amount: decimalSchema({}),
  notes: z.string().trim().max(1000).optional(),
  approveOverLimit: z.boolean().default(false),
});
export type CreateDebtInput = z.infer<typeof createDebtSchema>;

export const createPaymentSchema = z.object({
  amount: decimalSchema({}),
  notes: z.string().trim().max(1000).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const createAdjustmentSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((n) => Number.isFinite(n) && n !== 0, 'يجب أن يكون مبلغاً غير صفر'),
  notes: z.string().trim().min(1, 'يجب توضيح سبب التسوية').max(1000),
});
export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

export const cancelTransactionSchema = z.object({
  reason: z.string().trim().min(1, 'يجب ذكر السبب').max(500),
});
export type CancelTransactionInput = z.infer<typeof cancelTransactionSchema>;

export const listTransactionsQuerySchema = paginationSchema.extend({
  type: customerTransactionTypeEnum.optional(),
  includeCancelled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

// ─── customerId param helper (for /customers/:id/...) ───────
export const customerIdParamSchema = z.object({ id: cuidSchema });
