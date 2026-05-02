/**
 * Purchases + Products + Expenses schemas (Phase 4).
 */
import { z } from 'zod';
import { decimalSchema, paginationSchema } from './common';

// ─── Enums ───────────────────────────────────────────────────
export const purchaseModeEnum = z.enum(['TOTAL_ONLY', 'DETAILED_ITEMS']);
export type PurchaseModeZ = z.infer<typeof purchaseModeEnum>;

export const paymentTypeEnum = z.enum(['CASH', 'CREDIT']);
export type PaymentTypeZ = z.infer<typeof paymentTypeEnum>;

export const productStatusEnum = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']);
export type ProductStatusZ = z.infer<typeof productStatusEnum>;

export const expenseTypeEnum = z.enum(['NORMAL', 'SUPPLIER_PAYMENT', 'CASH_PURCHASE', 'OTHER']);
export type ExpenseTypeZ = z.infer<typeof expenseTypeEnum>;

// ─── Purchase item ────────────────────────────────────────────
export const purchaseItemSchema = z.object({
  productId: z.string().cuid().optional(),
  nameSnapshot: z.string().trim().min(1).max(200),
  quantity: z.number().positive({ message: 'الكمية يجب أن تكون أكبر من الصفر' }),
  unitCost: z.number().nonnegative(),
});
export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>;

// ─── Create purchase ──────────────────────────────────────────
export const createPurchaseSchema = z
  .object({
    supplierId: z.string().cuid().optional(),
    supplierNameManual: z.string().trim().max(200).optional(),
    purchaseMode: purchaseModeEnum,
    paymentType: paymentTypeEnum,
    totalAmount: decimalSchema({ allowZero: false }).optional(),
    detailsText: z.string().trim().max(1000).optional(),
    invoiceNumber: z.string().trim().max(100).optional(),
    purchaseDate: z.coerce.date().optional(),
    items: z.array(purchaseItemSchema).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.purchaseMode === 'TOTAL_ONLY' && !val.totalAmount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'المبلغ الإجمالي مطلوب لوضع الإجمالي',
        path: ['totalAmount'],
      });
    }
    if (val.purchaseMode === 'DETAILED_ITEMS' && (!val.items || val.items.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'يجب إضافة صنف واحد على الأقل للشراء التفصيلي',
        path: ['items'],
      });
    }
    if (val.paymentType === 'CREDIT' && !val.supplierId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'الشراء الآجل يتطلب اختيار تاجر مسجل',
        path: ['supplierId'],
      });
    }
  });
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

// ─── Cancel purchase ──────────────────────────────────────────
export const cancelPurchaseSchema = z.object({
  reason: z.string().trim().min(3, 'يجب ذكر سبب الإلغاء').max(500),
});
export type CancelPurchaseInput = z.infer<typeof cancelPurchaseSchema>;

// ─── List purchases query ─────────────────────────────────────
export const listPurchasesQuerySchema = paginationSchema.extend({
  supplierId: z.string().cuid().optional(),
  paymentType: paymentTypeEnum.optional(),
  purchaseMode: purchaseModeEnum.optional(),
  includeCancelled: z.coerce.boolean().default(false),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;

// ─── Create product ───────────────────────────────────────────
export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'اسم المنتج مطلوب').max(200),
  barcode: z.string().trim().max(100).optional(),
  unit: z.string().trim().max(50).default('حبة'),
  purchasePrice: decimalSchema({ allowZero: true }).default(0),
  salePrice: decimalSchema({ allowZero: true }).default(0),
  minQuantity: z.number().nonnegative().default(0),
  trackInventory: z.boolean().default(true),
  notes: z.string().trim().max(500).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

// ─── Update product ───────────────────────────────────────────
export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  barcode: z.string().trim().max(100).optional().nullable(),
  unit: z.string().trim().max(50).optional(),
  purchasePrice: decimalSchema({ allowZero: true }).optional(),
  salePrice: decimalSchema({ allowZero: true }).optional(),
  minQuantity: z.number().nonnegative().optional(),
  trackInventory: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
  status: productStatusEnum.optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ─── List products query ──────────────────────────────────────
export const listProductsQuerySchema = paginationSchema.extend({
  status: productStatusEnum.optional(),
  trackInventory: z.coerce.boolean().optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// ─── Create expense ───────────────────────────────────────────
export const createExpenseSchema = z
  .object({
    type: expenseTypeEnum,
    categoryId: z.string().cuid().optional(),
    supplierId: z.string().cuid().optional(),
    amount: decimalSchema({ allowZero: false }),
    detailsText: z.string().trim().max(1000).optional(),
    expenseDate: z.coerce.date().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'SUPPLIER_PAYMENT' && !val.supplierId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'دفع للتاجر يتطلب تحديد التاجر',
        path: ['supplierId'],
      });
    }
  });
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ─── Cancel expense ───────────────────────────────────────────
export const cancelExpenseSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});
export type CancelExpenseInput = z.infer<typeof cancelExpenseSchema>;

// ─── List expenses query ──────────────────────────────────────
export const listExpensesQuerySchema = paginationSchema.extend({
  type: expenseTypeEnum.optional(),
  supplierId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  includeCancelled: z.coerce.boolean().default(false),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;

// ─── Create/Update expense category ──────────────────────────
export const createExpenseCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type CreateExpenseCategoryInput = z.infer<typeof createExpenseCategorySchema>;
