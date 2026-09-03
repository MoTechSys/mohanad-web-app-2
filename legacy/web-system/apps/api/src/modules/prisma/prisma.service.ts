import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * PrismaService — wrapper مفرد حول PrismaClient.
 * - يفتح/يغلق الاتصال مع دورة حياة Nest.
 * - يكشف $transaction كما هو لاستخدامه في الخدمات.
 *
 * ⚠️ كل عملية مالية (sale, customer_tx, supplier_tx, expense, purchase, stock_move)
 *    يجب أن تتم داخل `prisma.$transaction(async (tx) => {...})` (القاعدة الذهبية #2).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('🔌 Prisma disconnected');
  }

  /** فحص بسيط لاتصال DB يستخدم في /health. */
  async pingDb(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error('DB ping failed', err as Error);
      return false;
    }
  }
}
