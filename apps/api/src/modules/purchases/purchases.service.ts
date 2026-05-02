import type { CancelPurchaseInput, CreatePurchaseInput, ListPurchasesQuery } from '@grocery/shared';
/**
 * PurchasesService — Phase 4 P4-3.
 *
 * Business rules:
 *   • CREDIT purchase → raises supplier.currentBalance + creates SupplierTransaction(CREDIT_PURCHASE).
 *   • CASH purchase → optionally creates Expense(CASH_PURCHASE). Does NOT touch supplier balance.
 *   • DETAILED_ITEMS → totalAmount auto-calculated from items.
 *   • Cancel reverses all effects inside a single DB transaction.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PurchaseScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: PurchaseScope, query: ListPurchasesQuery) {
    const {
      page,
      limit,
      supplierId,
      paymentType,
      purchaseMode,
      includeCancelled,
      dateFrom,
      dateTo,
      sortDir,
    } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(supplierId ? { supplierId } : {}),
      ...(paymentType ? { paymentType } : {}),
      ...(purchaseMode ? { purchaseMode } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(dateFrom || dateTo
        ? {
            purchaseDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseDate: sortDir },
        include: {
          supplier: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: PurchaseScope, id: string) {
    const p = await this.prisma.purchase.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
        items: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!p)
      throw new NotFoundException({ message: 'الفاتورة غير موجودة', code: 'PURCHASE_NOT_FOUND' });
    return p;
  }

  async create(scope: PurchaseScope, input: CreatePurchaseInput) {
    // Calculate total from items if detailed
    let totalAmount = Number(input.totalAmount ?? 0);
    const items = input.items ?? [];
    if (input.purchaseMode === 'DETAILED_ITEMS') {
      totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    }

    // Validate supplier for credit
    let supplier = null;
    if (input.paymentType === 'CREDIT' && input.supplierId) {
      supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, storeId: scope.storeId, deletedAt: null },
      });
      if (!supplier)
        throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // 1. Create the purchase
      const purchase = await tx.purchase.create({
        data: {
          storeId: scope.storeId,
          supplierId: input.supplierId ?? null,
          supplierNameManual: input.supplierNameManual ?? null,
          purchaseMode: input.purchaseMode,
          paymentType: input.paymentType,
          totalAmount,
          detailsText: input.detailsText ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          purchaseDate: input.purchaseDate ?? new Date(),
          createdById: scope.actorId,
        },
      });

      // 2. Create purchase items if detailed
      if (input.purchaseMode === 'DETAILED_ITEMS' && items.length > 0) {
        await tx.purchaseItem.createMany({
          data: items.map((item) => ({
            purchaseId: purchase.id,
            productId: item.productId ?? null,
            nameSnapshot: item.nameSnapshot,
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.quantity * item.unitCost,
          })),
        });
      }

      // 3. CREDIT → update supplier balance + create SupplierTransaction
      if (input.paymentType === 'CREDIT' && supplier) {
        const before = Number(supplier.currentBalance);
        const after = before + totalAmount;
        await tx.supplier.update({ where: { id: supplier.id }, data: { currentBalance: after } });
        await tx.supplierTransaction.create({
          data: {
            storeId: scope.storeId,
            supplierId: supplier.id,
            type: 'CREDIT_PURCHASE',
            amount: totalAmount,
            balanceBefore: before,
            balanceAfter: after,
            referenceType: 'purchase',
            referenceId: purchase.id,
            notes: input.detailsText ?? `شراء آجل #${purchase.id.slice(-6)}`,
            createdById: scope.actorId,
          },
        });
      }

      // 4. CASH → create Expense(CASH_PURCHASE)
      if (input.paymentType === 'CASH') {
        await tx.expense.create({
          data: {
            storeId: scope.storeId,
            type: 'CASH_PURCHASE',
            supplierId: input.supplierId ?? null,
            purchaseId: purchase.id,
            amount: totalAmount,
            detailsText: input.detailsText ?? `شراء نقدي #${purchase.id.slice(-6)}`,
            expenseDate: input.purchaseDate ?? new Date(),
            createdById: scope.actorId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'purchase',
          entityId: purchase.id,
          newValues: {
            totalAmount,
            paymentType: input.paymentType,
            purchaseMode: input.purchaseMode,
          },
        },
      });

      return purchase;
    });

    return this.findOne(scope, created.id);
  }

  async cancel(scope: PurchaseScope, id: string, input: CancelPurchaseInput) {
    const purchase = await this.findOne(scope, id);
    if (purchase.cancelledAt)
      throw new ConflictException({
        message: 'الفاتورة ملغاة مسبقاً',
        code: 'PURCHASE_ALREADY_CANCELLED',
      });

    await this.prisma.$transaction(async (tx) => {
      // Mark cancelled
      await tx.purchase.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: scope.actorId, cancelReason: input.reason },
      });

      // Reverse CREDIT: subtract from supplier balance + cancel supplier_transaction
      if (purchase.paymentType === 'CREDIT' && purchase.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: purchase.supplierId } });
        if (supplier) {
          const newBalance = Number(supplier.currentBalance) - Number(purchase.totalAmount);
          await tx.supplier.update({
            where: { id: purchase.supplierId },
            data: { currentBalance: newBalance },
          });
          await tx.supplierTransaction.updateMany({
            where: { referenceType: 'purchase', referenceId: id, cancelledAt: null },
            data: {
              cancelledAt: new Date(),
              cancelledById: scope.actorId,
              cancelReason: input.reason,
            },
          });
        }
      }

      // Cancel linked CASH expense
      if (purchase.paymentType === 'CASH') {
        await tx.expense.updateMany({
          where: { purchaseId: id, cancelledAt: null },
          data: {
            cancelledAt: new Date(),
            cancelledById: scope.actorId,
            cancelReason: input.reason,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'cancel',
          entityType: 'purchase',
          entityId: id,
          newValues: { reason: input.reason },
        },
      });
    });

    return this.findOne(scope, id);
  }
}
