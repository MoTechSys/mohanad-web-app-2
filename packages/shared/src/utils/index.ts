/**
 * Utilities مشتركة (formatters، helpers).
 * ⚠️ لا تعتمد على date-fns أو dayjs هنا — الـ shared package neutral.
 */

/**
 * تنسيق العملة بصيغة عربية لكن بأرقام إنجليزية (حسب القرار C3).
 * مثال: formatMoney(1234.5, 'YER') → "1,234.50 YER"
 */
export function formatMoney(amount: number | string, currency = 'YER'): string {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value)) return `0.00 ${currency}`;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

/**
 * تحويل decimal string من Prisma إلى number آمن.
 */
export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

/**
 * فحص امتلاك صلاحية واحدة.
 */
export function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.includes(required);
}

/**
 * فحص امتلاك جميع الصلاحيات المطلوبة.
 */
export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}

/**
 * فحص امتلاك أي صلاحية من القائمة.
 */
export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => userPermissions.includes(p));
}

/**
 * إخفاء جزء من رقم هاتف للعرض (privacy).
 * 967711234567 → "967******567"
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  const start = phone.slice(0, 3);
  const end = phone.slice(-3);
  return `${start}${'*'.repeat(phone.length - 6)}${end}`;
}
