import { z } from 'zod';

/**
 * Schema للتحقق من متغيرات البيئة عند بدء التشغيل.
 * يفشل التطبيق فوراً لو ناقص متغير حرج.
 */
export const configValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_VERSION: z.string().default('0.1.0'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_REFRESH_TTL_REMEMBER_ME: z.string().default('30d'),

  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z
    .string()
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  SEED_OWNER_USERNAME: z.string().default('owner'),
  SEED_OWNER_PASSWORD: z.string().default('Owner@12345'),
  SEED_OWNER_FULL_NAME: z.string().default('مالك المتجر'),
  SEED_STORE_NAME: z.string().default('بقالتي'),
});

export type AppConfig = z.infer<typeof configValidationSchema>;
