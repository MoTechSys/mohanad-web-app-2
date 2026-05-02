/**
 * Zod Schemas — Settings / Store Configuration (Phase 8)
 */
import { z } from 'zod';

// ─── WhatsApp reminder config stored as JSON in Setting.value ──
export const whatsappSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().max(500).optional(),
  senderPhone: z.string().max(30).optional(),
  defaultMessage: z.string().max(1000).optional(),
  reminderDayOfWeek: z.number().int().min(0).max(6).default(0), // 0=Sun
  reminderHour: z.number().int().min(0).max(23).default(9),
});
export type WhatsappSettings = z.infer<typeof whatsappSettingsSchema>;

// ─── Store info stored as JSON in Setting.value ────────────────
export const storeInfoSchema = z.object({
  storeName: z.string().max(100).optional(),
  ownerName: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  currency: z.string().max(10).default('SAR'),
  logoUrl: z.string().url().optional(),
});
export type StoreInfo = z.infer<typeof storeInfoSchema>;

// ─── Generic upsert ───────────────────────────────────────────
export const upsertSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});
export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

// ─── Customer reminder settings ───────────────────────────────
export const upsertCustomerReminderSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['weekly', 'monthly']).default('monthly'),
  templateId: z.string().optional(),
});
export type UpsertCustomerReminderInput = z.infer<typeof upsertCustomerReminderSchema>;
