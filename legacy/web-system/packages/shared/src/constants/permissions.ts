/**
 * PERMISSIONS — قائمة جميع صلاحيات النظام (مرجع ثابت)
 * المرجع: docs/04-rbac-permissions.md
 *
 * هذا الملف هو **مصدر الحقيقة الوحيد** لأكواد الصلاحيات.
 * - الباكند يستخدمها في PermissionGuard و prisma seed.
 * - الفرونت يستخدمها في hideOnNoPermission و usePermission().
 *
 * ⚠️ كل صلاحية يجب أن تكون مذكورة في docs/04 أيضاً.
 */

export const PERMISSIONS = {
  // 4.1 النظام والإعدادات
  SYSTEM: {
    DASHBOARD_VIEW: 'system.dashboard.view',
    SETTINGS_VIEW: 'system.settings.view',
    SETTINGS_UPDATE: 'system.settings.update',
    CURRENCY_UPDATE: 'system.currency.update',
    SALES_MODE_UPDATE: 'system.sales_mode.update',
    NOTIFICATIONS_SETTINGS_UPDATE: 'system.notifications_settings.update',
    BACKUP_VIEW: 'system.backup.view',
    BACKUP_CREATE: 'system.backup.create',
    BACKUP_RESTORE: 'system.backup.restore',
    APP_LOGS_VIEW: 'system.app_logs.view',
  },

  // 4.2 المستخدمون
  USERS: {
    VIEW: 'users.view',
    CREATE: 'users.create',
    UPDATE: 'users.update',
    DEACTIVATE: 'users.deactivate',
    ACTIVATE: 'users.activate',
    RESET_PASSWORD: 'users.reset_password',
    ASSIGN_ROLES: 'users.assign_roles',
    VIEW_ACTIVITY: 'users.view_activity',
    DELETE: 'users.delete',
  },

  // 4.3 الأدوار والصلاحيات
  ROLES: {
    VIEW: 'roles.view',
    CREATE: 'roles.create',
    UPDATE: 'roles.update',
    DELETE: 'roles.delete',
    ASSIGN_PERMISSIONS: 'roles.assign_permissions',
    CLONE: 'roles.clone',
    VIEW_PERMISSIONS: 'roles.view_permissions',
  },
  PERMISSIONS_META: {
    VIEW: 'permissions.view',
  },

  // 4.4 العملاء
  CUSTOMERS: {
    VIEW: 'customers.view',
    CREATE: 'customers.create',
    UPDATE: 'customers.update',
    DELETE: 'customers.delete',
    RESTORE: 'customers.restore',
    VIEW_BALANCE: 'customers.view_balance',
    VIEW_TRANSACTIONS: 'customers.view_transactions',
    SET_CREDIT_LIMIT: 'customers.set_credit_limit',
    FREEZE: 'customers.freeze',
    UNFREEZE: 'customers.unfreeze',
    GRANT_GRACE: 'customers.grant_grace',
    CLEAR_ACCOUNT: 'customers.clear_account',
    EXPORT: 'customers.export',
    PRINT_STATEMENT: 'customers.print_statement',
  },

  // 4.5 حركات ديون العملاء
  CUSTOMER_TRANSACTIONS: {
    VIEW: 'customer_transactions.view',
    CREATE_DEBT: 'customer_transactions.create_debt',
    CREATE_PAYMENT: 'customer_transactions.create_payment',
    CREATE_ADJUSTMENT: 'customer_transactions.create_adjustment',
    UPDATE: 'customer_transactions.update',
    CANCEL: 'customer_transactions.cancel',
    DELETE: 'customer_transactions.delete',
    APPROVE_OVER_LIMIT: 'customer_transactions.approve_over_limit',
    APPROVE_LARGE_AMOUNT: 'customer_transactions.approve_large_amount',
    PRINT_RECEIPT: 'customer_transactions.print_receipt',
  },

  // 4.6 البيع
  SALES: {
    VIEW: 'sales.view',
    CREATE: 'sales.create',
    CREATE_DETAILED: 'sales.create_detailed',
    CREATE_QUICK: 'sales.create_quick',
    CREATE_CASH: 'sales.create_cash',
    CREATE_CREDIT: 'sales.create_credit',
    UPDATE: 'sales.update',
    CANCEL: 'sales.cancel',
    REFUND: 'sales.refund',
    APPLY_DISCOUNT: 'sales.apply_discount',
    PRINT_RECEIPT: 'sales.print_receipt',
    VIEW_PROFIT: 'sales.view_profit',
    CLOSE_DAY: 'sales.close_day',
  },

  // 4.7 الدخل اليومي
  DAILY_INCOME: {
    VIEW: 'daily_income.view',
    CREATE: 'daily_income.create',
    UPDATE: 'daily_income.update',
    DELETE: 'daily_income.delete',
    APPROVE: 'daily_income.approve',
    PRINT: 'daily_income.print',
  },

  // 4.8 المصاريف
  EXPENSES: {
    VIEW: 'expenses.view',
    CREATE: 'expenses.create',
    CREATE_NORMAL: 'expenses.create_normal',
    CREATE_SUPPLIER_PAYMENT: 'expenses.create_supplier_payment',
    UPDATE: 'expenses.update',
    CANCEL: 'expenses.cancel',
    DELETE: 'expenses.delete',
    APPROVE: 'expenses.approve',
    PRINT: 'expenses.print',
  },
  EXPENSE_CATEGORIES: {
    MANAGE: 'expense_categories.manage',
  },

  // 4.9 التجار
  SUPPLIERS: {
    VIEW: 'suppliers.view',
    CREATE: 'suppliers.create',
    UPDATE: 'suppliers.update',
    DELETE: 'suppliers.delete',
    RESTORE: 'suppliers.restore',
    VIEW_BALANCE: 'suppliers.view_balance',
    VIEW_TRANSACTIONS: 'suppliers.view_transactions',
    SET_OPENING_BALANCE: 'suppliers.set_opening_balance',
    PRINT_STATEMENT: 'suppliers.print_statement',
  },

  // 4.10 حركات التجار
  SUPPLIER_TRANSACTIONS: {
    VIEW: 'supplier_transactions.view',
    CREATE_CREDIT_PURCHASE: 'supplier_transactions.create_credit_purchase',
    CREATE_PAYMENT: 'supplier_transactions.create_payment',
    CREATE_ADJUSTMENT: 'supplier_transactions.create_adjustment',
    UPDATE: 'supplier_transactions.update',
    CANCEL: 'supplier_transactions.cancel',
    DELETE: 'supplier_transactions.delete',
    PRINT_RECEIPT: 'supplier_transactions.print_receipt',
  },

  // 4.11 المشتريات
  PURCHASES: {
    VIEW: 'purchases.view',
    CREATE: 'purchases.create',
    CREATE_CASH: 'purchases.create_cash',
    CREATE_CREDIT: 'purchases.create_credit',
    CREATE_WITH_ITEMS: 'purchases.create_with_items',
    CREATE_TOTAL_ONLY: 'purchases.create_total_only',
    UPDATE: 'purchases.update',
    CANCEL: 'purchases.cancel',
    DELETE: 'purchases.delete',
    PRINT_INVOICE: 'purchases.print_invoice',
    APPROVE: 'purchases.approve',
  },

  // 4.12 المنتجات والمخزون
  PRODUCTS: {
    VIEW: 'products.view',
    CREATE: 'products.create',
    UPDATE: 'products.update',
    DELETE: 'products.delete',
    ARCHIVE: 'products.archive',
    ACTIVATE: 'products.activate',
    PAUSE: 'products.pause',
    MANAGE_PRICES: 'products.manage_prices',
    MANAGE_COST: 'products.manage_cost',
  },
  INVENTORY: {
    VIEW: 'inventory.view',
    ENABLE: 'inventory.enable',
    DISABLE: 'inventory.disable',
  },
  STOCK_MOVEMENTS: {
    VIEW: 'stock_movements.view',
    CREATE_IN: 'stock_movements.create_in',
    CREATE_OUT: 'stock_movements.create_out',
    ADJUST: 'stock_movements.adjust',
    CANCEL: 'stock_movements.cancel',
    PRINT: 'stock_movements.print',
  },

  // 4.13 - 4.15 التقارير
  REPORTS: {
    DASHBOARD_VIEW: 'reports.dashboard.view',
    DAILY_SUMMARY_VIEW: 'reports.daily_summary.view',
    WEEKLY_SUMMARY_VIEW: 'reports.weekly_summary.view',
    MONTHLY_SUMMARY_VIEW: 'reports.monthly_summary.view',
    PROFIT_LOSS_VIEW: 'reports.profit_loss.view',
    CASH_FLOW_VIEW: 'reports.cash_flow.view',
    SALES_VIEW: 'reports.sales.view',
    CUSTOMER_DEBTS_VIEW: 'reports.customer_debts.view',
    CUSTOMER_STATEMENT_VIEW: 'reports.customer_statement.view',
    SUPPLIER_DEBTS_VIEW: 'reports.supplier_debts.view',
    SUPPLIER_STATEMENT_VIEW: 'reports.supplier_statement.view',
    PURCHASES_VIEW: 'reports.purchases.view',
    EXPENSES_VIEW: 'reports.expenses.view',
    INVENTORY_VIEW: 'reports.inventory.view',
    USER_ACTIVITY_VIEW: 'reports.user_activity.view',
    AUDIT_VIEW: 'reports.audit.view',
    BEHAVIOR_ANALYSIS_VIEW: 'reports.behavior_analysis.view',

    PRINT_DAILY_SUMMARY: 'reports.print.daily_summary',
    PRINT_MONTHLY_SUMMARY: 'reports.print.monthly_summary',
    PRINT_PROFIT_LOSS: 'reports.print.profit_loss',
    PRINT_CASH_FLOW: 'reports.print.cash_flow',
    PRINT_CUSTOMER_DEBTS: 'reports.print.customer_debts',
    PRINT_CUSTOMER_STATEMENT: 'reports.print.customer_statement',
    PRINT_SUPPLIER_DEBTS: 'reports.print.supplier_debts',
    PRINT_SUPPLIER_STATEMENT: 'reports.print.supplier_statement',
    PRINT_PURCHASES: 'reports.print.purchases',
    PRINT_EXPENSES: 'reports.print.expenses',
    PRINT_INVENTORY: 'reports.print.inventory',
    PRINT_USER_ACTIVITY: 'reports.print.user_activity',

    EXPORT_DAILY_SUMMARY: 'reports.export.daily_summary',
    EXPORT_MONTHLY_SUMMARY: 'reports.export.monthly_summary',
    EXPORT_PROFIT_LOSS: 'reports.export.profit_loss',
    EXPORT_CASH_FLOW: 'reports.export.cash_flow',
    EXPORT_CUSTOMER_DEBTS: 'reports.export.customer_debts',
    EXPORT_CUSTOMER_STATEMENT: 'reports.export.customer_statement',
    EXPORT_SUPPLIER_DEBTS: 'reports.export.supplier_debts',
    EXPORT_SUPPLIER_STATEMENT: 'reports.export.supplier_statement',
    EXPORT_PURCHASES: 'reports.export.purchases',
    EXPORT_EXPENSES: 'reports.export.expenses',
    EXPORT_INVENTORY: 'reports.export.inventory',
    EXPORT_USER_ACTIVITY: 'reports.export.user_activity',
  },

  // 4.16 الإشعارات
  NOTIFICATIONS: {
    VIEW_OWN: 'notifications.view_own',
    VIEW_ALL: 'notifications.view_all',
    CREATE: 'notifications.create',
    MARK_READ: 'notifications.mark_read',
    MANAGE_SETTINGS: 'notifications.manage_settings',
    MANAGE_TEMPLATES: 'notifications.manage_templates',
    SEND_INTERNAL: 'notifications.send_internal',
    SEND_WHATSAPP: 'notifications.send_whatsapp',
    SCHEDULE_CUSTOMER_REMINDERS: 'notifications.schedule_customer_reminders',
    CANCEL_SCHEDULED: 'notifications.cancel_scheduled',
  },

  // 4.17 سجل الحركات
  AUDIT_LOGS: {
    VIEW: 'audit_logs.view',
    VIEW_SENSITIVE: 'audit_logs.view_sensitive',
    PRINT: 'audit_logs.print',
    EXPORT: 'audit_logs.export',
  },
} as const;

/**
 * قائمة مسطحة بكل أكواد الصلاحيات (للـ seed و للتحقق).
 */
export const ALL_PERMISSION_CODES: string[] = Object.values(PERMISSIONS).flatMap((group) =>
  Object.values(group),
);

/**
 * بيانات وصفية لكل صلاحية (الاسم العربي + المجموعة).
 * تُستخدم في:
 *   - prisma seed (لإنشاء سجلات permissions كاملة).
 *   - شاشة إدارة الأدوار (لعرض شجرة قابلة للقراءة).
 */
export interface PermissionMeta {
  code: string;
  module: string;
  action: string;
  labelAr: string;
  groupAr: string;
}

export const PERMISSION_GROUPS_AR: Record<string, string> = {
  system: 'النظام والإعدادات',
  users: 'المستخدمون',
  roles: 'الأدوار والصلاحيات',
  permissions: 'الأدوار والصلاحيات',
  customers: 'العملاء',
  customer_transactions: 'حركات ديون العملاء',
  sales: 'البيع',
  daily_income: 'الدخل اليومي',
  expenses: 'المصاريف',
  expense_categories: 'المصاريف',
  suppliers: 'التجار (الموردون)',
  supplier_transactions: 'حركات التجار',
  purchases: 'المشتريات',
  products: 'المنتجات',
  inventory: 'المخزون',
  stock_movements: 'حركات المخزون',
  reports: 'التقارير',
  notifications: 'الإشعارات',
  audit_logs: 'سجل الحركات',
};

/**
 * تصنيف صلاحية بناء على الـ code.
 */
export function describePermission(code: string): PermissionMeta {
  const [moduleRaw, ...rest] = code.split('.');
  const module = moduleRaw ?? 'unknown';
  const action = rest.join('.') || 'view';
  return {
    code,
    module,
    action,
    labelAr: code, // اسم تفصيلي يُملأ في seed عبر جدول ترجمة منفصل لاحقاً
    groupAr: PERMISSION_GROUPS_AR[module] ?? module,
  };
}
