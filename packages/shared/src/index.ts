/**
 * @grocery/shared — entry point
 *
 * يصدّر جميع الأنواع والثوابت والمخططات والأدوات المشتركة بين apps/api و apps/web.
 *
 * ملاحظة: نستخدم extension-less imports لأن:
 *   • TypeScript مع moduleResolution=Bundler (الـ web) يحلّ تلقائياً.
 *   • Node ESM (الـ API) يحتاج .js — لذا نقاط الدخول من الـ API تستخدم
 *     ts-node/tsx الذي يحلّها على .ts.
 */

export * from './constants/index';
export * from './types/index';
export * from './schemas/index';
export * from './utils/index';
