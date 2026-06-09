import type {
  CancelSupplierTransactionInput,
  CreateSupplierAdjustmentInput,
  CreateSupplierPaymentInput,
  ListSupplierTransactionsQuery,
} from '@grocery/shared';
/**
 * SupplierTransactionsService — Phase 4 P4-2.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lockSupplierBalance } from '../../common/db/lock-balance';
import { PrismaService } from '../prisma/prisma.service';

interface TxScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SupplierTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: TxScope, supplierId: string, query: ListSupplierTransactionsQuery) {
    await this.assertSupplier(scope, supplierId);
    const { page, limit, type, includeCancelled, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      supplierId,
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplierTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.supplierTransaction.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPayment(scope: TxScope, supplierId: string, input: CreateSupplierPaymentInput) {
    await this.assertSupplier(scope, supplierId);
    const amount = Number(input.amount);
    if (amount <= 0)
      throw new BadRequestException({
        message: 'المبلغ يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    return this.prisma.$transaction(async (db) => {
      // Golden rule #6: lock + re-read inside the transaction.
      const before = await lockSupplierBalance(db, supplierId);
      const after = before - amount;
      const row = await db.supplierTransaction.create({
        data: {
          storeId: scope.storeId,
          supplierId,
          type: 'PAYMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await db.supplier.update({ where: { id: supplierId }, data: { currentBalance: after } });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'supplier_transaction',
          entityId: row.id,
          newValues: { type: 'PAYMENT', amount, balanceAfter: after },
        },
      });
      return row;
    });
  }

  async createAdjustment(scope: TxScope, supplierId: string, input: CreateSupplierAdjustmentInput) {
    await this.assertSupplier(scope, supplierId);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount === 0)
      throw new BadRequestException({
        message: 'مبلغ التسوية لا يمكن أن يكون صفراً',
        code: 'INVALID_AMOUNT',
      });
    return this.prisma.$transaction(async (db) => {
      // Golden rule #6: lock + re-read inside the transaction.
      const before = await lockSupplierBalance(db, supplierId);
      const after = before + amount;
      const row = await db.supplierTransaction.create({
        data: {
          storeId: scope.storeId,
          supplierId,
          type: 'ADJUSTMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes,
          createdById: scope.actorId,
        },
      });
      await db.supplier.update({ where: { id: supplierId }, data: { currentBalance: after } });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'supplier_transaction',
          entityId: row.id,
          newValues: { type: 'ADJUSTMENT', amount, balanceAfter: after },
        },
      });
      return row;
    });
  }

  async cancel(
    scope: TxScope,
    supplierId: string,
    txId: string,
    input: CancelSupplierTransactionInput,
  ) {
    await this.assertSupplier(scope, supplierId);
    const original = await this.prisma.supplierTransaction.findFirst({
      where: { id: txId, supplierId },
    });
    if (!original)
      throw new NotFoundException({ message: 'الحركة غير موجودة', code: 'TX_NOT_FOUND' });
    if (original.cancelledAt)
      throw new ConflictException({ message: 'الحركة ملغاة مسبقاً', code: 'TX_ALREADY_CANCELLED' });
    if (original.type === 'OPENING')
      throw new ConflictException({
        message: 'لا يمكن إلغاء الرصيد الافتتاحي',
        code: 'TX_OPENING_PROTECTED',
      });
    const reverseDelta =
      original.type === 'PAYMENT' ? Number(original.amount) : -Number(original.amount);
    return this.prisma.$transaction(async (db) => {
      // Golden rule #6: lock + re-read inside the transaction.
      const lockedBalance = await lockSupplierBalance(db, supplierId);
      const newBalance = lockedBalance + reverseDelta;
      const updated = await db.supplierTransaction.update({
        where: { id: txId },
        data: { cancelledAt: new Date(), cancelledById: scope.actorId, cancelReason: input.reason },
      });
      await db.supplier.update({ where: { id: supplierId }, data: { currentBalance: newBalance } });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'supplier_transaction',
          entityId: txId,
          oldValues: { type: original.type, amount: original.amount },
          newValues: { newBalance, reason: input.reason },
        },
      });
      return { ...updated, newBalance };
    });
  }

  private async assertSupplier(scope: TxScope, supplierId: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id: supplierId, storeId: scope.storeId, deletedAt: null },
    });
    if (!s)
      throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    return s;
  }
}
