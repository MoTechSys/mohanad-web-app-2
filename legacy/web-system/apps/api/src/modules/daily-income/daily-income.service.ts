import type {
  CancelDailyIncomeInput,
  CreateDailyIncomeInput,
  ListDailyIncomeQuery,
} from '@grocery/shared';
/**
 * DailyIncomeService — Phase 6 (P6-1).
 * إدارة الإيرادات اليومية من مصادر غير المبيعات.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DailyIncomeScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class DailyIncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: DailyIncomeScope, query: ListDailyIncomeQuery) {
    const { page, limit, isApproved, includeCancelled, dateFrom, dateTo, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(isApproved !== undefined ? { isApproved } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(dateFrom || dateTo
        ? {
            incomeDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dailyIncome.findMany({
        where,
        skip,
        take: limit,
        orderBy: { incomeDate: sortDir },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          approvedBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.dailyIncome.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: DailyIncomeScope, id: string) {
    const r = await this.prisma.dailyIncome.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
        approvedBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!r) throw new NotFoundException('سجل الإيراد غير موجود');
    return r;
  }

  async create(scope: DailyIncomeScope, input: CreateDailyIncomeInput) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dailyIncome.create({
        data: {
          storeId: scope.storeId,
          amount: input.amount,
          source: input.source ?? 'نقدي',
          ...(input.detailsText ? { detailsText: input.detailsText } : {}),
          incomeDate: input.incomeDate ?? new Date(),
          createdById: scope.actorId,
        },
      });
      // Golden rule #3: audit sensitive financial operations.
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'daily_income',
          entityId: row.id,
          newValues: { amount: row.amount, source: row.source },
        },
      });
      return row;
    });
  }

  async approve(scope: DailyIncomeScope, id: string) {
    const r = await this.prisma.dailyIncome.findFirst({ where: { id, storeId: scope.storeId } });
    if (!r) throw new NotFoundException('سجل الإيراد غير موجود');
    if (r.cancelledAt) throw new ConflictException('لا يمكن اعتماد سجل ملغى');
    if (r.isApproved) throw new ConflictException('السجل معتمد مسبقاً');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dailyIncome.update({
        where: { id },
        data: { isApproved: true, approvedById: scope.actorId, approvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'daily_income',
          entityId: id,
          newValues: { isApproved: true },
        },
      });
      return row;
    });
  }

  async cancel(scope: DailyIncomeScope, id: string, input: CancelDailyIncomeInput) {
    const r = await this.prisma.dailyIncome.findFirst({ where: { id, storeId: scope.storeId } });
    if (!r) throw new NotFoundException('سجل الإيراد غير موجود');
    if (r.cancelledAt) throw new ConflictException('السجل ملغى مسبقاً');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.dailyIncome.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: scope.actorId, cancelReason: input.reason },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'daily_income',
          entityId: id,
          oldValues: { amount: r.amount },
          newValues: { reason: input.reason ?? null },
        },
      });
      return row;
    });
  }

  async todayStats(scope: DailyIncomeScope) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const agg = await this.prisma.dailyIncome.aggregate({
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        incomeDate: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
      _count: true,
    });
    return { count: agg._count ?? 0, total: Number(agg._sum.amount ?? 0) };
  }
}
