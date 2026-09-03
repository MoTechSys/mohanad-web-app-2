import type {
  CancelExpenseInput,
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  ListExpensesQuery,
} from '@grocery/shared';
/**
 * ExpensesService — Phase 4 P4-5.
 *
 * Types:
 *   NORMAL / OTHER → direct operational expense.
 *   SUPPLIER_PAYMENT → also creates SupplierTransaction(PAYMENT) + updates supplier balance.
 *   CASH_PURCHASE → created automatically by PurchasesService, can also be manual.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { lockSupplierBalance } from '../../common/db/lock-balance';
import { flagIfLargeTransaction } from '../../common/finance/large-transaction';
import { PrismaService } from '../prisma/prisma.service';

export interface ExpenseScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Categories ───────────────────────────────────────────
  async listCategories(scope: ExpenseScope) {
    return this.prisma.expenseCategory.findMany({
      where: { storeId: scope.storeId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(scope: ExpenseScope, input: CreateExpenseCategoryInput) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { storeId_name: { storeId: scope.storeId, name: input.name } },
    });
    if (existing)
      throw new ConflictException({ message: 'التصنيف موجود بالفعل', code: 'CATEGORY_CONFLICT' });
    return this.prisma.expenseCategory.create({
      data: { storeId: scope.storeId, name: input.name },
    });
  }

  async deleteCategory(scope: ExpenseScope, id: string) {
    const cat = await this.prisma.expenseCategory.findFirst({
      where: { id, storeId: scope.storeId },
    });
    if (!cat)
      throw new NotFoundException({ message: 'التصنيف غير موجود', code: 'CATEGORY_NOT_FOUND' });
    await this.prisma.expenseCategory.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  }

  // ─── Expenses ─────────────────────────────────────────────
  async list(scope: ExpenseScope, query: ListExpensesQuery) {
    const {
      page,
      limit,
      type,
      supplierId,
      categoryId,
      includeCancelled,
      dateFrom,
      dateTo,
      sortDir,
    } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(type ? { type } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(dateFrom || dateTo
        ? {
            expenseDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: sortDir },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.expense.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: ExpenseScope, id: string) {
    const e = await this.prisma.expense.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        category: true,
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
      },
    });
    if (!e)
      throw new NotFoundException({ message: 'المصروف غير موجود', code: 'EXPENSE_NOT_FOUND' });
    return e;
  }

  async create(scope: ExpenseScope, input: CreateExpenseInput) {
    const amount = Number(input.amount);
    const created = await this.prisma.$transaction(async (tx) => {
      // Validate supplier for supplier_payment
      let supplier = null;
      if (input.type === 'SUPPLIER_PAYMENT' && input.supplierId) {
        supplier = await tx.supplier.findFirst({
          where: { id: input.supplierId, storeId: scope.storeId, deletedAt: null },
        });
        if (!supplier)
          throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
      }

      const expense = await tx.expense.create({
        data: {
          storeId: scope.storeId,
          type: input.type,
          categoryId: input.categoryId ?? null,
          supplierId: input.supplierId ?? null,
          amount,
          detailsText: input.detailsText ?? null,
          expenseDate: input.expenseDate ?? new Date(),
          createdById: scope.actorId,
        },
      });

      // SUPPLIER_PAYMENT → update supplier balance + create SupplierTransaction(PAYMENT)
      if (input.type === 'SUPPLIER_PAYMENT' && supplier) {
        // Golden rule #6: lock + re-read inside the transaction.
        const before = await lockSupplierBalance(tx, supplier.id);
        const after = before - amount;
        await tx.supplier.update({ where: { id: supplier.id }, data: { currentBalance: after } });
        await tx.supplierTransaction.create({
          data: {
            storeId: scope.storeId,
            supplierId: supplier.id,
            type: 'PAYMENT',
            amount,
            balanceBefore: before,
            balanceAfter: after,
            referenceType: 'expense',
            referenceId: expense.id,
            notes: input.detailsText ?? 'دفعة للتاجر',
            createdById: scope.actorId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'expense',
          entityId: expense.id,
          newValues: { type: input.type, amount },
        },
      });

      // Design B5: flag large transactions.
      await flagIfLargeTransaction(tx, {
        storeId: scope.storeId,
        actorId: scope.actorId,
        amount: Number(amount),
        entityType: 'expense',
        entityId: expense.id,
        label: 'مصروف',
      });
      return expense;
    });
    return this.findOne(scope, created.id);
  }

  async cancel(scope: ExpenseScope, id: string, input: CancelExpenseInput) {
    const expense = await this.findOne(scope, id);
    if (expense.cancelledAt)
      throw new ConflictException({
        message: 'المصروف ملغى مسبقاً',
        code: 'EXPENSE_ALREADY_CANCELLED',
      });

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: scope.actorId, cancelReason: input.reason },
      });

      // Reverse SUPPLIER_PAYMENT
      if (expense.type === 'SUPPLIER_PAYMENT' && expense.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: expense.supplierId } });
        if (supplier) {
          // Golden rule #6: lock + re-read inside the transaction.
          const lockedBalance = await lockSupplierBalance(tx, expense.supplierId);
          const newBalance = lockedBalance + Number(expense.amount);
          await tx.supplier.update({
            where: { id: expense.supplierId },
            data: { currentBalance: newBalance },
          });
          await tx.supplierTransaction.updateMany({
            where: { referenceType: 'expense', referenceId: id, cancelledAt: null },
            data: {
              cancelledAt: new Date(),
              cancelledById: scope.actorId,
              cancelReason: input.reason,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'expense',
          entityId: id,
          newValues: { reason: input.reason },
        },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Stats: today ─────────────────────────────────────────
  async todayStats(scope: ExpenseScope) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const agg = await this.prisma.expense.aggregate({
      where: {
        storeId: scope.storeId,
        cancelledAt: null,
        expenseDate: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
      _count: true,
    });
    return {
      total: Number(agg._sum.amount ?? 0),
      count: agg._count,
    };
  }
}
