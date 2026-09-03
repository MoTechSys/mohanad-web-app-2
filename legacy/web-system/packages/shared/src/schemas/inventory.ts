/**
 * Zod Schemas — Inventory / Stock Movements (Phase 7)
 */
import { z } from 'zod';
import { paginationSchema } from './common';

export const stockMovementTypeSchema = z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN', 'LOSS']);

export const createStockMovementSchema = z.object({
  productId: z.string().cuid('معرف المنتج غير صالح'),
  type: stockMovementTypeSchema,
  quantity: z.number().positive('الكمية يجب أن تكون موجبة'),
  reason: z.string().max(300).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().optional(),
});
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export const cancelStockMovementSchema = z.object({
  reason: z.string().max(300).optional(),
});
export type CancelStockMovementInput = z.infer<typeof cancelStockMovementSchema>;

export const listStockMovementsQuerySchema = paginationSchema.extend({
  productId: z.string().cuid().optional(),
  type: stockMovementTypeSchema.optional(),
  includeCancelled: z.coerce.boolean().default(false),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListStockMovementsQuery = z.infer<typeof listStockMovementsQuerySchema>;
