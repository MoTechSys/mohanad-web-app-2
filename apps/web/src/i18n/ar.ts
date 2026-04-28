/**
 * Simple Arabic translation map (Q8 of agent-memory: no react-i18next).
 *
 * Usage:
 *   import { t } from '@/i18n/ar';
 *   <h1>{t('login.title')}</h1>
 *
 * Future English/Multi-locale support is deferred to v2.
 */

const dict = {
  app: {
    name: 'نظام إدارة بقالة',
    shortName: 'بقالتي',
    tagline: 'إدارة بقالتك بكل بساطة',
  },
  common: {
    loading: 'جاري التحميل…',
    error: 'حدث خطأ، يرجى المحاولة مجدداً',
    retry: 'إعادة المحاولة',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    save: 'حفظ',
    delete: 'حذف',
    edit: 'تعديل',
    search: 'بحث',
    empty: 'لا توجد بيانات لعرضها',
    yes: 'نعم',
    no: 'لا',
    back: 'رجوع',
    next: 'التالي',
    submit: 'إرسال',
    backToHome: 'العودة للرئيسية',
  },
  login: {
    title: 'تسجيل الدخول',
    subtitle: 'مرحباً بك مجدداً، أدخل بياناتك للمتابعة',
    username: 'اسم المستخدم',
    usernamePlaceholder: 'مثال: owner',
    password: 'كلمة المرور',
    passwordPlaceholder: '••••••••',
    rememberMe: 'تذكرني',
    forgotPassword: 'نسيت كلمة المرور؟',
    submit: 'دخول',
    submitting: 'جاري الدخول…',
    notImplemented: 'تسجيل الدخول الفعلي يبدأ في المرحلة 2',
  },
  dashboard: {
    title: 'لوحة التحكم',
    welcome: 'أهلاً بك',
    todayIncome: 'مبيعات اليوم',
    todayExpenses: 'مصاريف اليوم',
    netProfit: 'صافي الربح',
    customersWithDebt: 'عملاء عليهم ديون',
    quickActions: 'إجراءات سريعة',
    quickSale: 'بيع سريع',
    addDebt: 'إضافة دين',
    recordPayment: 'تسجيل سداد',
    addExpense: 'إضافة مصروف',
  },
  notFound: {
    code: '404',
    title: 'الصفحة غير موجودة',
    message: 'الصفحة التي تبحث عنها قد تم نقلها أو حذفها.',
  },
  health: {
    label: 'حالة النظام',
    ok: 'يعمل بشكل طبيعي',
    degraded: 'يعمل جزئياً',
    down: 'متوقف',
  },
  permission: {
    denied: 'لا تملك صلاحية الوصول',
  },
} as const;

type Dict = typeof dict;

type DotKeys<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends object ? DotKeys<T[K], `${P}${K}.`> : `${P}${K}`;
}[keyof T & string];

export type TranslationKey = DotKeys<Dict>;

/**
 * Look up an Arabic translation by dotted key.
 * Returns the key itself when missing — visible miss is helpful in dev.
 */
export function t(key: TranslationKey): string {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic dotted lookup
  let cur: any = dict;
  for (const segment of (key as string).split('.')) {
    if (cur && typeof cur === 'object' && segment in cur) {
      cur = cur[segment];
    } else {
      return key as string;
    }
  }
  return typeof cur === 'string' ? cur : (key as string);
}

export const i18n = { t, dict };
