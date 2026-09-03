import type { CreateProductInput, ListProductsQuery, UpdateProductInput } from '@grocery/shared';
/**
 * ProductsService — Phase 4 P4-4.
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: ProductScope, query: ListProductsQuery) {
    const { page, limit, search, status, trackInventory, sortDir } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(trackInventory !== undefined ? { trackInventory } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: sortDir },
        select: {
          id: true,
          name: true,
          barcode: true,
          unit: true,
          purchasePrice: true,
          salePrice: true,
          currentQuantity: true,
          minQuantity: true,
          trackInventory: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: ProductScope, id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      include: { createdBy: { select: { id: true, username: true, fullName: true } } },
    });
    if (!p) throw new NotFoundException({ message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
    return p;
  }

  async create(scope: ProductScope, input: CreateProductInput) {
    // Check barcode uniqueness within store
    if (input.barcode) {
      const existing = await this.prisma.product.findFirst({
        where: { storeId: scope.storeId, barcode: input.barcode, deletedAt: null },
      });
      if (existing)
        throw new ConflictException({
          message: 'الباركود مستخدم بالفعل',
          code: 'BARCODE_CONFLICT',
        });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          storeId: scope.storeId,
          name: input.name,
          barcode: input.barcode ?? null,
          unit: input.unit ?? 'حبة',
          purchasePrice: Number(input.purchasePrice ?? 0),
          salePrice: Number(input.salePrice ?? 0),
          minQuantity: input.minQuantity ?? 0,
          trackInventory: input.trackInventory ?? true,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'product',
          entityId: product.id,
          newValues: { name: product.name, barcode: product.barcode },
        },
      });
      return product;
    });
    return this.findOne(scope, created.id);
  }

  async update(scope: ProductScope, id: string, input: UpdateProductInput) {
    const before = await this.assertExists(scope, id);
    if (input.barcode && input.barcode !== before.barcode) {
      const existing = await this.prisma.product.findFirst({
        where: { storeId: scope.storeId, barcode: input.barcode, deletedAt: null, id: { not: id } },
      });
      if (existing)
        throw new ConflictException({
          message: 'الباركود مستخدم بالفعل',
          code: 'BARCODE_CONFLICT',
        });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.barcode !== undefined ? { barcode: input.barcode ?? null } : {}),
          ...(input.unit !== undefined ? { unit: input.unit } : {}),
          ...(input.purchasePrice !== undefined
            ? { purchasePrice: Number(input.purchasePrice) }
            : {}),
          ...(input.salePrice !== undefined ? { salePrice: Number(input.salePrice) } : {}),
          ...(input.minQuantity !== undefined ? { minQuantity: input.minQuantity } : {}),
          ...(input.trackInventory !== undefined ? { trackInventory: input.trackInventory } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'product',
          entityId: id,
          oldValues: { name: before.name, status: before.status },
          newValues: { ...input },
        },
      });
    });
    return this.findOne(scope, id);
  }

  async remove(scope: ProductScope, id: string) {
    await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'ARCHIVED' },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'delete',
          entityType: 'product',
          entityId: id,
        },
      });
    });
    return { ok: true };
  }

  private async assertExists(scope: ProductScope, id: string) {
    const p = await this.prisma.product.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
    });
    if (!p) throw new NotFoundException({ message: 'المنتج غير موجود', code: 'PRODUCT_NOT_FOUND' });
    return p;
  }
}
