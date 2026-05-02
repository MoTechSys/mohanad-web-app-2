import type { UpsertCustomerReminderInput, UpsertSettingInput } from '@grocery/shared';
/**
 * SettingsService — Phase 8 (P8-1).
 *
 * Stores key/value JSON settings per store in the `settings` table.
 * Well-known keys:
 *   • "store_info"  → StoreInfo
 *   • "whatsapp"    → WhatsappSettings
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SettingsScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Get all settings for a store ─────────────────────────
  async getAll(scope: SettingsScope) {
    const rows = await this.prisma.setting.findMany({
      where: { storeId: scope.storeId },
      orderBy: { key: 'asc' },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  // ─── Get single setting by key ─────────────────────────────
  async getByKey(scope: SettingsScope, key: string) {
    const row = await this.prisma.setting.findUnique({
      where: { storeId_key: { storeId: scope.storeId, key } },
    });
    return row ? row.value : null;
  }

  // ─── Upsert setting ────────────────────────────────────────
  async upsert(scope: SettingsScope, input: UpsertSettingInput) {
    const { key, value } = input;
    return this.prisma.setting.upsert({
      where: { storeId_key: { storeId: scope.storeId, key } },
      create: { storeId: scope.storeId, key, value: value as never },
      update: { value: value as never },
    });
  }

  // ─── Delete setting ────────────────────────────────────────
  async delete(scope: SettingsScope, key: string) {
    await this.prisma.setting.deleteMany({
      where: { storeId: scope.storeId, key },
    });
    return { ok: true };
  }

  // ─── Customer reminder settings ────────────────────────────
  async getCustomerReminder(scope: SettingsScope, customerId: string) {
    return this.prisma.customerReminderSettings.findUnique({
      where: { customerId },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });
  }

  async upsertCustomerReminder(
    scope: SettingsScope,
    customerId: string,
    input: UpsertCustomerReminderInput,
  ) {
    // Verify customer belongs to store
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId: scope.storeId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) throw new Error('العميل غير موجود');

    return this.prisma.customerReminderSettings.upsert({
      where: { customerId },
      create: { customerId, ...input },
      update: { ...input },
    });
  }

  async listCustomerReminders(scope: SettingsScope) {
    return this.prisma.customerReminderSettings.findMany({
      where: {
        customer: { storeId: scope.storeId, deletedAt: null },
        enabled: true,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, balance: true } },
      },
      orderBy: { lastSentAt: 'asc' },
    });
  }

  // ─── Mark reminder as sent ─────────────────────────────────
  async markReminderSent(customerId: string) {
    return this.prisma.customerReminderSettings.update({
      where: { customerId },
      data: { lastSentAt: new Date() },
    });
  }
}
