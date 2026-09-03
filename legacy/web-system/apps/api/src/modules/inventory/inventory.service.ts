import type {
  CancelStockMovementInput,
  CreateStockMovementInput,
  ListStockMovementsQuery,
} from '@grocery/shared';
/**
 * InventoryService — Phase 7 (P7-1).
 *
 * Business rules:
 *   • Every manual movement records quantityBefore/quantityChange/quantityAfter atomically.
 *   • IN/RETURN increase currentQuantity; OUT/LOSS decrease; ADJUSTMENT = absolute delta.
 *   • Cancel reverses the quantity change inside a single DB transaction.
 *   • Low-stock check: after every OUT/LOSS — if quantity falls below minQuantity.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface InventoryScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List movements ───────────────────────────────────────
  async listMovements(scope: InventoryScope, query: ListStockMovementsQuery) {
    const { page, limit, productId, type, includeCancelled, dateFrom, dateTo, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(productId ? { productId } : {}),
      ...(type ? { type } : {}),
      ...(includeCancelled ? {} : { cancelledAt: null }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        include: {
          product: { select: { id: true, name: true, unit: true } },
          createdBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Product inventory card ────────────────────────────────
  async productCard(scope: InventoryScope, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        unit: true,
        barcode: true,
        purchasePrice: true,
        salePrice: true,
        currentQuantity: true,
        minQuantity: true,
        trackInventory: true,
        status: true,
      },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');

    const lastMovements = await this.prisma.stockMovement.findMany({
      where: { productId, cancelledAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { createdBy: { select: { id: true, username: true } } },
    });

    return {
      product,
      isLowStock: Number(product.currentQuantity) <= Number(product.minQuantity),
      lastMovements,
    };
  }

  // ─── Low stock products ────────────────────────────────────
  async lowStockProducts(scope: InventoryScope) {
    return this.prisma.product.findMany({
      where: {
        storeId: scope.storeId,
        deletedAt: null,
        trackInventory: true,
        status: 'ACTIVE',
      },
      orderBy: { currentQuantity: 'asc' },
      select: {
        id: true,
        name: true,
        unit: true,
        barcode: true,
        currentQuantity: true,
        minQuantity: true,
        salePrice: true,
      },
    });
  }

  // ─── Create manual movement ────────────────────────────────
  async createMovement(scope: InventoryScope, input: CreateStockMovementInput) {
    const { storeId, actorId } = scope;
    const { productId, type, quantity, reason, referenceType, referenceId } = input;

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');

    return this.prisma.$transaction(async (tx) => {
      const quantityBefore = Number(product.currentQuantity);
      let quantityChange: number;
      let quantityAfter: number;

      switch (type) {
        case 'IN':
        case 'RETURN':
          quantityChange = quantity;
          quantityAfter = quantityBefore + quantity;
          break;
        case 'OUT':
        case 'LOSS':
          quantityChange = -quantity;
          quantityAfter = quantityBefore - quantity;
          break;
        case 'ADJUSTMENT':
          // quantity = الرصيد الجديد المطلوب
          quantityChange = quantity - quantityBefore;
          quantityAfter = quantity;
          break;
        default:
          quantityChange = quantity;
          quantityAfter = quantityBefore + quantity;
      }

      // تحديث المخزون
      await tx.product.update({
        where: { id: productId },
        data: { currentQuantity: quantityAfter },
      });

      // تسجيل الحركة
      const movement = await tx.stockMovement.create({
        data: {
          storeId,
          productId,
          type,
          quantityBefore,
          quantityChange,
          quantityAfter,
          reason,
          ...(referenceType ? { referenceType } : {}),
          ...(referenceId ? { referenceId } : {}),
          createdById: actorId,
        },
        include: { product: { select: { id: true, name: true, unit: true } } },
      });

      // Golden rule #3: audit stock movements.
      await tx.auditLog.create({
        data: {
          storeId,
          actorId,
          action: 'create',
          entityType: 'stock_movement',
          entityId: movement.id,
          newValues: { productId, type, quantityChange, quantityBefore, quantityAfter },
        },
      });

      return { movement, isLowStock: quantityAfter <= Number(product.minQuantity) };
    });
  }

  // ─── Cancel movement ───────────────────────────────────────
  async cancelMovement(scope: InventoryScope, id: string, input: CancelStockMovementInput) {
    const { storeId, actorId } = scope;
    const m = await this.prisma.stockMovement.findFirst({ where: { id, storeId } });
    if (!m) throw new NotFoundException('حركة المخزون غير موجودة');
    if (m.cancelledAt) throw new ConflictException('الحركة ملغاة مسبقاً');

    return this.prisma.$transaction(async (tx) => {
      // عكس الكمية
      const reverseChange = -Number(m.quantityChange);
      await tx.product.update({
        where: { id: m.productId },
        data: { currentQuantity: { increment: reverseChange } },
      });

      const updated = await tx.stockMovement.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancelledById: actorId,
          cancelReason: input.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          storeId,
          actorId,
          action: 'cancel',
          entityType: 'stock_movement',
          entityId: id,
          oldValues: { quantityChange: m.quantityChange },
          newValues: { reason: input.reason ?? null },
        },
      });
      return updated;
    });
  }

  // ─── Summary stats ─────────────────────────────────────────
  async inventoryStats(scope: InventoryScope) {
    const { storeId } = scope;
    const [total, active, lowStock, outOfStock] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { storeId, deletedAt: null } }),
      this.prisma.product.count({ where: { storeId, deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.product.count({
        where: {
          storeId,
          deletedAt: null,
          trackInventory: true,
          status: 'ACTIVE',
          currentQuantity: { lte: this.prisma.product.fields.minQuantity },
        },
      }),
      this.prisma.product.count({
        where: {
          storeId,
          deletedAt: null,
          trackInventory: true,
          currentQuantity: { lte: 0 },
        },
      }),
    ]);
    return { total, active, lowStock, outOfStock };
  }
}
