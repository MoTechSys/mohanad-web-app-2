/**
 * Zod Schemas — Daily Income (Phase 6)
 */
import { z } from 'zod';
import { paginationSchema } from './common';

export const createDailyIncomeSchema = z.object({
  amount: z.number().positive('المبلغ يجب أن يكون موجباً'),
  source: z.string().min(1).max(100).default('نقدي'),
  detailsText: z.string().max(500).optional(),
  incomeDate: z.coerce.date().optional(),
});
export type CreateDailyIncomeInput = z.infer<typeof createDailyIncomeSchema>;

export const cancelDailyIncomeSchema = z.object({
  reason: z.string().max(300).optional(),
});
export type CancelDailyIncomeInput = z.infer<typeof cancelDailyIncomeSchema>;

export const listDailyIncomeQuerySchema = paginationSchema.extend({
  isApproved: z.coerce.boolean().optional(),
  includeCancelled: z.coerce.boolean().default(false),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListDailyIncomeQuery = z.infer<typeof listDailyIncomeQuerySchema>;
