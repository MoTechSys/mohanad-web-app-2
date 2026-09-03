export * from './permissions';
export * from './roles';
export * from './enums';

// =====================================================
// إعدادات افتراضية للنظام
// =====================================================
export const DEFAULT_SETTINGS = {
  STORE_NAME: 'بقالتي',
  CURRENCY: 'YER',
  PROFIT_CALCULATION_MODE: 'estimated_by_daily_income' as const,
  LARGE_TRANSACTION_THRESHOLD: 50000,
  OPENING_CASH_BALANCE: 0,
  CUSTOMER_BEHAVIOR_DROP_PERCENT: 50,
  CUSTOMER_BEHAVIOR_WINDOW_DAYS: 30,
  INVENTORY_ENABLED: false,
};

// =====================================================
// قيود تقنية
// =====================================================
export const LIMITS = {
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  DECIMAL_PRECISION: 14,
  DECIMAL_SCALE: 2,
};

// =====================================================
// رؤوس HTTP خاصة بالنظام
// =====================================================
export const HEADERS = {
  IDEMPOTENCY_KEY: 'Idempotency-Key',
  REQUEST_ID: 'X-Request-Id',
};

// =====================================================
// JWT TTL
// =====================================================
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_DEFAULT = '7d';
export const REFRESH_TOKEN_TTL_REMEMBER_ME = '30d';

// =====================================================
// Rate limiting
// =====================================================
export const RATE_LIMIT_LOGIN = { points: 5, windowMs: 15 * 60 * 1000 } as const;
export const RATE_LIMIT_GLOBAL = { points: 100, windowMs: 60 * 1000 } as const;

// =====================================================
// عتبات وإشعارات
// =====================================================
export const DEFAULT_LARGE_TX_THRESHOLD = 50000;
export const DESKTOP_BREAKPOINT_PX = 768;
export const CUSTOMER_BEHAVIOR_DROP_RATIO = 0.5;
export const CUSTOMER_BEHAVIOR_WINDOW_DAYS = 30;
export const IDEMPOTENCY_HEADER = 'idempotency-key';
