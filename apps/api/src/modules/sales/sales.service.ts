import type { CancelSaleInput, CreateSaleInput, ListSalesQuery } from '@grocery/shared';
/**
 * SalesService — Phase 5 (P5-2).
 * CREDIT sale → raises customer.currentBalance + creates CustomerTransaction(DEBT).
 * CASH sale → no balance change.
 * DETAILED_ITEMS → netAmount auto-calculated from items; discount applied.
 * Cancel reverses all effects inside a single DB transaction.
 * Inventory tracking: currentQuantity reduced on DETAILED_ITEMS sale.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { lockCustomerBalance } from '../../common/db/lock-balance';
import { PrismaService } from '../prisma/prisma.service';

export interface SaleScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: SaleScope, query: ListSalesQuery) {
    const {
      page,
      limit,
      customerId,
      paymentType,
      saleMode,
      includeCancelled,
      dateFrom,
      dateTo,
      sortDir,
    } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(customerId ? { customerId } : {}),
      ...(paymentType ? { paymentType } : {}),
      ...(saleMode ? { saleMode } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(dateFrom || dateTo
        ? {
            saleDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { saleDate: sortDir },
        include: {
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: SaleScope, id: string) {
    const s = await this.prisma.sale.findFirst({
      where: { id, storeId: scope.storeId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, username: true, fullName: true } },
        cancelledBy: { select: { id: true, username: true, fullName: true } },
        items: { include: { product: { select: { id: true, name: true, unit: true } } } },
      },
    });
    if (!s) throw new NotFoundException('فاتورة البيع غير موجودة');
    return s;
  }

  async create(scope: SaleScope, input: CreateSaleInput) {
    const { storeId, actorId } = scope;
    const {
      customerId,
      saleMode,
      paymentType,
      discountAmount = 0,
      detailsText,
      invoiceNumber,
      saleDate,
      totalAmount,
      items,
    } = input;

    if (invoiceNumber) {
      const dup = await this.prisma.sale.findFirst({ where: { invoiceNumber, cancelledAt: null } });
      if (dup) throw new ConflictException('رقم الفاتورة مستخدم مسبقاً');
    }

    let computedTotal: number;
    let saleItemsData: Array<{
      productId?: string;
      nameSnapshot: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    if (saleMode === 'DETAILED_ITEMS') {
      if (!items || items.length === 0) throw new BadRequestException('يجب تحديد بنود البيع');
      saleItemsData = items.map((it) => ({
        productId: it.productId,
        nameSnapshot: it.nameSnapshot,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        totalPrice: it.quantity * it.unitPrice,
      }));
      computedTotal = saleItemsData.reduce((s, i) => s + i.totalPrice, 0);
    } else {
      if (!totalAmount) throw new BadRequestException('يجب تحديد المبلغ الإجمالي');
      computedTotal = totalAmount;
    }

    const netAmount = computedTotal - discountAmount;
    if (netAmount < 0) throw new BadRequestException('المبلغ الصافي لا يمكن أن يكون سالباً');

    let customer: { id: string; currentBalance: { toNumber(): number } } | null = null;
    if (paymentType === 'CREDIT') {
      if (!customerId) throw new BadRequestException('البيع الآجل يتطلب تحديد العميل');
      customer = await this.prisma.customer.findFirst({
        where: { id: customerId, storeId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException('العميل غير موجود');
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          storeId,
          ...(customerId ? { customerId } : {}),
          saleMode: saleMode ?? 'TOTAL_ONLY',
          paymentType,
          totalAmount: computedTotal,
          discountAmount,
          netAmount,
          ...(detailsText ? { detailsText } : {}),
          ...(invoiceNumber ? { invoiceNumber } : {}),
          saleDate: saleDate ?? new Date(),
          createdById: actorId,
          ...(saleMode === 'DETAILED_ITEMS' ? { items: { create: saleItemsData } } : {}),
        },
        include: { items: true },
      });

      if (paymentType === 'CREDIT' && customer) {
        // Golden rule #6: lock + re-read inside the transaction.
        const balanceBefore = await lockCustomerBalance(tx, customer.id);
        const balanceAfter = balanceBefore + netAmount;
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: balanceAfter },
        });
        await tx.customerTransaction.create({
          data: {
            customerId: customer.id,
            type: 'DEBT',
            amount: netAmount,
            balanceBefore,
            balanceAfter,
            notes: `فاتورة بيع${invoiceNumber ? ` #${invoiceNumber}` : ''}`,
            referenceType: 'SALE',
            referenceId: sale.id,
            createdById: actorId,
          },
        });
      }

      if (saleMode === 'DETAILED_ITEMS') {
        for (const item of saleItemsData) {
          if (!item.productId) continue;
          const prod = await tx.product.findFirst({
            where: { id: item.productId, trackInventory: true },
          });
          if (prod) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentQuantity: { decrement: item.quantity } },
            });
          }
        }
      }

      return sale;
    });
  }

  async cancel(scope: SaleScope, id: string, input: CancelSaleInput) {
    const { storeId, actorId } = scope;
    const sale = await this.prisma.sale.findFirst({
      where: { id, storeId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('فاتورة البيع غير موجودة');
    if (sale.cancelledAt) throw new ConflictException('الفاتورة ملغاة مسبقاً');

    return this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id },
        data: { cancelledAt: new Date(), cancelledById: actorId, cancelReason: input.reason },
      });

      if (sale.paymentType === 'CREDIT' && sale.customerId) {
        const cust = await tx.customer.findFirst({ where: { id: sale.customerId } });
        if (cust) {
          const net = Number(sale.netAmount);
          // Golden rule #6: lock + re-read inside the transaction.
          const balanceBefore = await lockCustomerBalance(tx, sale.customerId);
          const balanceAfter = balanceBefore - net;
          await tx.customer.update({
            where: { id: sale.customerId },
            data: { currentBalance: balanceAfter },
          });
          await tx.customerTransaction.create({
            data: {
              customerId: sale.customerId,
              type: 'ADJUSTMENT',
              amount: -net,
              balanceBefore,
              balanceAfter,
              notes: 'إلغاء فاتورة بيع',
              referenceType: 'SALE_CANCEL',
              referenceId: id,
              createdById: actorId,
            },
          });
        }
      }

      if (sale.saleMode === 'DETAILED_ITEMS') {
        for (const item of sale.items) {
          if (!item.productId) continue;
          const prod = await tx.product.findFirst({
            where: { id: item.productId, trackInventory: true },
          });
          if (prod) {
            await tx.product.update({
              where: { id: item.productId },
              data: { currentQuantity: { increment: Number(item.quantity) } },
            });
          }
        }
      }

      return tx.sale.findFirst({ where: { id }, include: { items: true } });
    });
  }

  async todayStats(scope: SaleScope) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [cash, credit] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({
        where: {
          storeId: scope.storeId,
          paymentType: 'CASH',
          cancelledAt: null,
          saleDate: { gte: today, lt: tomorrow },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.sale.aggregate({
        where: {
          storeId: scope.storeId,
          paymentType: 'CREDIT',
          cancelledAt: null,
          saleDate: { gte: today, lt: tomorrow },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    const cashTotal = Number(cash._sum.netAmount ?? 0);
    const creditTotal = Number(credit._sum.netAmount ?? 0);
    return {
      totalSales: (cash._count ?? 0) + (credit._count ?? 0),
      cashTotal,
      creditTotal,
      grandTotal: cashTotal + creditTotal,
    };
  }
}
