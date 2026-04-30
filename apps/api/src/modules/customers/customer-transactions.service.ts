/**
 * CustomerTransactionsService — Phase 3 P3-4.
 *
 * Append-only ledger:
 *   • Every DEBT / PAYMENT / ADJUSTMENT mutates Customer.currentBalance
 *     INSIDE the same `prisma.$transaction` that creates the ledger row.
 *   • Snapshots `balanceBefore` / `balanceAfter` are captured atomically.
 *   • Cancellation is soft (original row preserved) — a *reverse* effect
 *     is applied to Customer.currentBalance, again inside a transaction.
 *
 * Business rules:
 *   • FROZEN customer → cannot record debts (PAYMENT still allowed).
 *   • Credit-limit exceeded → requires `customer_transactions.approve_over_limit`
 *     permission AND `approveOverLimit: true` in the body.
 *   • A `Notification` row of type CREDIT_LIMIT_EXCEEDED is emitted
 *     whenever a debt is approved that lands above the limit.
 */

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CustomerTransactionType, Prisma } from '@prisma/client';

import type {
  CancelTransactionInput,
  CreateAdjustmentInput,
  CreateDebtInput,
  CreatePaymentInput,
  ListTransactionsQuery,
} from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface TxScope {
  storeId: string;
  actorId: string;
  /** flat list of permission codes for the actor (from JwtAuthGuard). */
  permissions: string[];
}

@Injectable()
export class CustomerTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List per customer ────────────────────────────────────
  async list(scope: TxScope, customerId: string, query: ListTransactionsQuery) {
    await this.assertCustomer(scope, customerId);
    const { page, limit, type, includeCancelled, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      customerId,
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.customerTransaction.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Create DEBT (atomic + credit-limit check) ────────────
  async createDebt(scope: TxScope, customerId: string, input: CreateDebtInput) {
    const customer = await this.assertCustomer(scope, customerId);
    if (customer.status === 'FROZEN') {
      throw new ConflictException({
        message: 'العميل مُجمَّد — لا يمكن تسجيل دين',
        code: 'CUSTOMER_FROZEN',
      });
    }
    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new BadRequestException({
        message: 'المبلغ يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }

    const before = Number(customer.currentBalance);
    const after = before + amount;
    const limit = customer.creditLimit !== null ? Number(customer.creditLimit) : null;
    const exceedsLimit = limit !== null && after > limit;

    if (exceedsLimit) {
      if (!input.approveOverLimit) {
        throw new ConflictException({
          message: 'تجاوز سقف الدين — يلزم موافقة',
          code: 'CREDIT_LIMIT_EXCEEDED',
          meta: { currentBalance: before, after, creditLimit: limit },
        });
      }
      if (!scope.permissions.includes('customer_transactions.approve_over_limit')) {
        throw new ForbiddenException({
          message: 'لا تملك صلاحية الموافقة على تجاوز سقف الدين',
          code: 'PERMISSION_DENIED',
        });
      }
    }

    const tx = await this.prisma.$transaction(async (db) => {
      const created = await db.customerTransaction.create({
        data: {
          customerId,
          type: 'DEBT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await db.customer.update({
        where: { id: customerId },
        data: { currentBalance: after },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'customer_transaction',
          entityId: created.id,
          newValues: { type: 'DEBT', amount, balanceAfter: after },
          metadata: exceedsLimit ? { exceedsLimit: true, limit } : undefined,
        },
      });
      if (exceedsLimit) {
        await db.notification.create({
          data: {
            storeId: scope.storeId,
            userId: null, // broadcast (Owner/Manager)
            type: 'CREDIT_LIMIT_EXCEEDED',
            title: 'تجاوز سقف الدين',
            body: `تم تسجيل دين للعميل "${customer.name}" برصيد ${after} (سقف ${limit}).`,
            metadata: {
              customerId,
              customerName: customer.name,
              amount,
              balanceAfter: after,
              creditLimit: limit,
            },
          },
        });
      }
      return created;
    });
    return tx;
  }

  // ─── Create PAYMENT (atomic) ──────────────────────────────
  async createPayment(scope: TxScope, customerId: string, input: CreatePaymentInput) {
    const customer = await this.assertCustomer(scope, customerId);
    const amount = Number(input.amount);
    if (amount <= 0) {
      throw new BadRequestException({
        message: 'المبلغ يجب أن يكون أكبر من الصفر',
        code: 'INVALID_AMOUNT',
      });
    }
    const before = Number(customer.currentBalance);
    const after = before - amount;

    const created = await this.prisma.$transaction(async (db) => {
      const row = await db.customerTransaction.create({
        data: {
          customerId,
          type: 'PAYMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await db.customer.update({
        where: { id: customerId },
        data: {
          currentBalance: after,
          // a payment that brings balance into grace clears grace state
          ...(customer.status === 'GRACE_PERIOD' && after <= 0
            ? { status: 'ACTIVE', graceUntil: null }
            : {}),
        },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'customer_transaction',
          entityId: row.id,
          newValues: { type: 'PAYMENT', amount, balanceAfter: after },
        },
      });
      return row;
    });
    return created;
  }

  // ─── Create ADJUSTMENT (signed) ───────────────────────────
  async createAdjustment(scope: TxScope, customerId: string, input: CreateAdjustmentInput) {
    const customer = await this.assertCustomer(scope, customerId);
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      throw new BadRequestException({
        message: 'مبلغ التسوية يجب ألا يكون صفراً',
        code: 'INVALID_AMOUNT',
      });
    }
    const before = Number(customer.currentBalance);
    const after = before + amount; // can be positive or negative

    const created = await this.prisma.$transaction(async (db) => {
      const row = await db.customerTransaction.create({
        data: {
          customerId,
          type: 'ADJUSTMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes,
          createdById: scope.actorId,
        },
      });
      await db.customer.update({
        where: { id: customerId },
        data: { currentBalance: after },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer_transaction',
          entityId: row.id,
          newValues: { type: 'ADJUSTMENT', amount, balanceAfter: after, reason: input.notes },
        },
      });
      return row;
    });
    return created;
  }

  // ─── Cancel (reverse balance, soft-mark row) ──────────────
  async cancel(scope: TxScope, customerId: string, txId: string, input: CancelTransactionInput) {
    await this.assertCustomer(scope, customerId);
    const original = await this.prisma.customerTransaction.findFirst({
      where: { id: txId, customerId },
    });
    if (!original) {
      throw new NotFoundException({
        message: 'الحركة غير موجودة',
        code: 'TX_NOT_FOUND',
      });
    }
    if (original.cancelledAt) {
      throw new ConflictException({
        message: 'الحركة ملغاة مسبقاً',
        code: 'TX_ALREADY_CANCELLED',
      });
    }
    if (original.type === 'OPENING') {
      throw new ConflictException({
        message: 'لا يمكن إلغاء الرصيد الافتتاحي',
        code: 'TX_OPENING_PROTECTED',
      });
    }

    // Reverse effect: subtract original signed delta from currentBalance.
    // - DEBT      added +amount  → cancel subtracts amount
    // - PAYMENT   subtracted amount → cancel adds amount
    // - ADJUSTMENT added signed amount → cancel subtracts signed amount
    const reverseDelta =
      original.type === 'PAYMENT' ? Number(original.amount) : -Number(original.amount);

    const result = await this.prisma.$transaction(async (db) => {
      const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
      const newBalance = Number(customer.currentBalance) + reverseDelta;
      const updated = await db.customerTransaction.update({
        where: { id: txId },
        data: {
          cancelledAt: new Date(),
          cancelledById: scope.actorId,
          cancelReason: input.reason,
        },
      });
      await db.customer.update({
        where: { id: customerId },
        data: { currentBalance: newBalance },
      });
      await db.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'customer_transaction',
          entityId: txId,
          oldValues: {
            type: original.type,
            amount: original.amount,
            balanceAfter: original.balanceAfter,
          },
          newValues: { newBalance, reason: input.reason },
        },
      });
      return { ...updated, newBalance };
    });
    return result;
  }

  // ─── Helpers ──────────────────────────────────────────────
  private async assertCustomer(scope: TxScope, customerId: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id: customerId, storeId: scope.storeId, deletedAt: null },
    });
    if (!c) {
      throw new NotFoundException({
        message: 'العميل غير موجود',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }
    return c;
  }

  // expose enum to controller (suppress unused-import warning if needed)
  static readonly TYPES: CustomerTransactionType[] = ['DEBT', 'PAYMENT', 'ADJUSTMENT', 'OPENING'];

  // helper kept for typing tests
  static readonly _PRISMA_SENTINEL: Prisma.CustomerTransactionWhereInput | undefined = undefined;
}
