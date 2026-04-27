/**
 * Enums مشتركة بين الفرونت والباكند.
 * يجب أن تطابق `enum` في prisma/schema.prisma بدقة.
 */

// ─── Sales ──────────────────────────────────────
export const SALE_MODES = ['detailed', 'quick_amount', 'hybrid'] as const;
export type SaleMode = (typeof SALE_MODES)[number];

export const PAYMENT_TYPES = ['cash', 'credit'] as const; // mixed مؤجل لـ v2
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const SALE_STATUSES = ['active', 'cancelled'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

// ─── Customer Transactions ──────────────────────
export const CUSTOMER_TX_TYPES = ['debt', 'payment', 'adjustment', 'opening_balance'] as const;
export type CustomerTxType = (typeof CUSTOMER_TX_TYPES)[number];

// ─── Supplier Transactions ──────────────────────
export const SUPPLIER_TX_TYPES = ['debt', 'payment', 'adjustment', 'opening_balance'] as const;
export type SupplierTxType = (typeof SUPPLIER_TX_TYPES)[number];

// ─── Purchases ──────────────────────────────────
export const PURCHASE_MODES = ['detailed', 'quick_total'] as const;
export type PurchaseMode = (typeof PURCHASE_MODES)[number];

export const PURCHASE_PAYMENT_TYPES = ['cash', 'credit'] as const;
export type PurchasePaymentType = (typeof PURCHASE_PAYMENT_TYPES)[number];

// ─── Expenses ───────────────────────────────────
export const EXPENSE_TYPES = ['normal', 'supplier_payment', 'other'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

// ─── Stock Movements ────────────────────────────
export const STOCK_MOVE_TYPES = [
  'in', // شراء
  'out', // بيع
  'adjustment_in', // تسوية إضافية
  'adjustment_out', // تسوية ناقصة
  'damaged', // تالف
  'returned', // مرتجع
] as const;
export type StockMoveType = (typeof STOCK_MOVE_TYPES)[number];

// ─── Profit Calculation Mode ────────────────────
export const PROFIT_CALC_MODES = [
  'accurate_by_sales_items',
  'estimated_by_daily_income',
  'manual_cogs',
] as const;
export type ProfitCalcMode = (typeof PROFIT_CALC_MODES)[number];

// ─── Notifications ──────────────────────────────
export const NOTIFICATION_TYPES = [
  'info',
  'warning',
  'danger',
  'success',
  'behavior_alert',
  'low_stock',
  'large_transaction',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['internal', 'whatsapp_manual'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ─── Audit Logs ─────────────────────────────────
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'cancel',
  'delete',
  'restore',
  'login',
  'login_failed',
  'logout',
  'permission_denied',
  'role_change',
  'permission_change',
  'password_reset',
  'user_deactivate',
  'user_reactivate',
  'settings_change',
  'large_transaction',
  'export',
  'print',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ─── Customer flags ─────────────────────────────
export const CUSTOMER_STATUSES = ['active', 'frozen', 'graced', 'archived'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

// ─── Currency (نص فقط حسب القرار A2) ────────────
export const SUPPORTED_CURRENCIES = ['YER', 'SAR', 'USD', 'EUR', 'AED', 'EGP'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];
