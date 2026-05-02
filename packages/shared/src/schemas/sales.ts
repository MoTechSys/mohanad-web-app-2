/**
 * Zod Schemas — Sales (Phase 5)
 */
import { z } from 'zod';
import { paginationSchema } from './common';

export const saleModeSchema = z.enum(['TOTAL_ONLY', 'DETAILED_ITEMS']);
export const salePaymentTypeSchema = z.enum(['CASH', 'CREDIT']);

export const createSaleItemSchema = z.object({
  productId: z.string().cuid().optional(),
  nameSnapshot: z.string().min(1, 'اسم المنتج مطلوب').max(200),
  quantity: z.number().positive('الكمية يجب أن تكون موجبة'),
  unitPrice: z.number().nonnegative('السعر لا يمكن أن يكون سالباً'),
});
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>;

export const createSaleSchema = z
  .object({
    customerId: z.string().cuid().optional(),
    saleMode: saleModeSchema.default('TOTAL_ONLY'),
    paymentType: salePaymentTypeSchema,
    discountAmount: z.number().nonnegative().default(0),
    detailsText: z.string().max(500).optional(),
    invoiceNumber: z.string().max(50).optional(),
    saleDate: z.coerce.date().optional(),
    totalAmount: z.number().positive().optional(),
    items: z.array(createSaleItemSchema).min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.saleMode === 'TOTAL_ONLY' && !data.totalAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب تحديد المبلغ الإجمالي',
        path: ['totalAmount'],
      });
    }
    if (data.saleMode === 'DETAILED_ITEMS' && (!data.items || data.items.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب إضافة بنود للبيع التفصيلي',
        path: ['items'],
      });
    }
    if (data.paymentType === 'CREDIT' && !data.customerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'البيع الآجل يتطلب تحديد العميل',
        path: ['customerId'],
      });
    }
  });
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const cancelSaleSchema = z.object({
  reason: z.string().max(300).optional(),
});
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;

export const listSalesQuerySchema = paginationSchema.extend({
  customerId: z.string().cuid().optional(),
  paymentType: salePaymentTypeSchema.optional(),
  saleMode: saleModeSchema.optional(),
  includeCancelled: z.coerce.boolean().default(false),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
