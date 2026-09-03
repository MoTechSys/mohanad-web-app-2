/**
 * Suppliers + SupplierTransactions schemas (Phase 4).
 */
import { z } from 'zod';
import {
  arabicNameSchema,
  cuidSchema,
  decimalSchema,
  paginationSchema,
  phoneSchema,
} from './common';

// ─── Enums ───────────────────────────────────────────────────
export const supplierTransactionTypeEnum = z.enum([
  'CREDIT_PURCHASE',
  'PAYMENT',
  'ADJUSTMENT',
  'OPENING',
]);
export type SupplierTransactionTypeZ = z.infer<typeof supplierTransactionTypeEnum>;

// ─── Create supplier ─────────────────────────────────────────
export const createSupplierSchema = z.object({
  name: arabicNameSchema,
  phone: phoneSchema,
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
  openingBalance: decimalSchema({ allowZero: true }).default(0),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

// ─── Update supplier ─────────────────────────────────────────
export const updateSupplierSchema = z.object({
  name: arabicNameSchema.optional(),
  phone: phoneSchema,
  address: z.string().trim().max(300).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

// ─── Set opening balance ─────────────────────────────────────
export const setSupplierOpeningBalanceSchema = z.object({
  openingBalance: decimalSchema({ allowZero: true }),
});
export type SetSupplierOpeningBalanceInput = z.infer<typeof setSupplierOpeningBalanceSchema>;

// ─── List suppliers query ─────────────────────────────────────
export const listSuppliersQuerySchema = paginationSchema.extend({
  hasDebt: z.coerce.boolean().optional(),
});
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;

// ─── Create supplier payment (debt to supplier) ───────────────
export const createSupplierPaymentSchema = z.object({
  amount: decimalSchema({ allowZero: false }),
  notes: z.string().trim().max(500).optional(),
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

// ─── Create supplier adjustment ───────────────────────────────
export const createSupplierAdjustmentSchema = z.object({
  amount: z
    .number()
    .finite()
    .refine((n) => n !== 0, { message: 'مبلغ التسوية لا يمكن أن يكون صفراً' }),
  notes: z.string().trim().min(3, 'يجب ذكر سبب التسوية').max(500),
});
export type CreateSupplierAdjustmentInput = z.infer<typeof createSupplierAdjustmentSchema>;

// ─── Cancel supplier transaction ──────────────────────────────
export const cancelSupplierTransactionSchema = z.object({
  reason: z.string().trim().min(3, 'يجب ذكر سبب الإلغاء').max(500),
});
export type CancelSupplierTransactionInput = z.infer<typeof cancelSupplierTransactionSchema>;

// ─── List supplier transactions ───────────────────────────────
export const listSupplierTransactionsQuerySchema = paginationSchema.extend({
  type: supplierTransactionTypeEnum.optional(),
  includeCancelled: z.coerce.boolean().default(false),
});
export type ListSupplierTransactionsQuery = z.infer<typeof listSupplierTransactionsQuerySchema>;
