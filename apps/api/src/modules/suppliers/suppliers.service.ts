import type {
  CreateSupplierInput,
  ListSuppliersQuery,
  SetSupplierOpeningBalanceInput,
  UpdateSupplierInput,
} from '@grocery/shared';
/**
 * SuppliersService — Phase 4 P4-1.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SupplierScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(scope: SupplierScope, query: ListSuppliersQuery) {
    const { page, limit, search, sortBy, sortDir, hasDebt } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(hasDebt ? { currentBalance: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };
    const orderBy = sortBy ? { [sortBy]: sortDir } : { createdAt: sortDir };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          phone: true,
          currentBalance: true,
          openingBalance: true,
          createdAt: true,
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      include: { createdBy: { select: { id: true, username: true, fullName: true } } },
    });
    if (!s)
      throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    return s;
  }

  async getBalance(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      select: { id: true, name: true, currentBalance: true, openingBalance: true },
    });
    if (!s)
      throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    return s;
  }

  async statement(scope: SupplierScope, id: string, page = 1, limit = 50) {
    const supplier = await this.getBalance(scope, id);
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplierTransaction.findMany({
        where: { supplierId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.supplierTransaction.count({ where: { supplierId: id } }),
    ]);
    return { supplier, items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async create(scope: SupplierScope, input: CreateSupplierInput) {
    const opening = Number(input.openingBalance ?? 0);
    const created = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.create({
        data: {
          storeId: scope.storeId,
          name: input.name,
          phone: input.phone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          openingBalance: opening,
          currentBalance: opening,
          createdById: scope.actorId,
        },
      });
      if (opening !== 0) {
        await tx.supplierTransaction.create({
          data: {
            storeId: scope.storeId,
            supplierId: supplier.id,
            type: 'OPENING',
            amount: opening,
            balanceBefore: 0,
            balanceAfter: opening,
            createdById: scope.actorId,
            notes: 'رصيد افتتاحي',
          },
        });
      }
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'create',
          entityType: 'supplier',
          entityId: supplier.id,
          newValues: { name: supplier.name, openingBalance: opening },
        },
      });
      return supplier;
    });
    return this.findOne(scope, created.id);
  }

  async update(scope: SupplierScope, id: string, input: UpdateSupplierInput) {
    const before = await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
          ...(input.address !== undefined ? { address: input.address ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'supplier',
          entityId: id,
          oldValues: { name: before.name, phone: before.phone },
          newValues: { ...input },
        },
      });
    });
    return this.findOne(scope, id);
  }

  async remove(scope: SupplierScope, id: string) {
    const before = await this.assertExists(scope, id);
    if (Number(before.currentBalance) !== 0) {
      throw new ConflictException({
        message: 'لا يمكن حذف تاجر لديه رصيد',
        code: 'SUPPLIER_HAS_BALANCE',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'delete',
          entityType: 'supplier',
          entityId: id,
        },
      });
    });
    return { ok: true };
  }

  async restore(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({ where: { id, storeId: scope.storeId } });
    if (!s)
      throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    await this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { deletedAt: null } });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'restore',
          entityType: 'supplier',
          entityId: id,
        },
      });
    });
    return this.findOne(scope, id);
  }

  private async assertExists(scope: SupplierScope, id: string) {
    const s = await this.prisma.supplier.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
    });
    if (!s)
      throw new NotFoundException({ message: 'التاجر غير موجود', code: 'SUPPLIER_NOT_FOUND' });
    return s;
  }

  async getById(id: string) {
    return this.prisma.supplier.findUnique({ where: { id } });
  }
  // ─── Record supplier payment (we pay supplier) ─────────────
  async recordPayment(scope: SupplierScope, id: string, input: { amount: number; notes?: string }) {
    const supplier = await this.assertExists(scope, id);
    const amount = Number(input.amount);
    if (amount <= 0) throw new BadRequestException('مبلغ الدفع يجب أن يكون موجباً');
    const before = Number(supplier.currentBalance);
    const after = before - amount;
    return this.prisma.$transaction(async (tx) => {
      await tx.supplier.update({ where: { id }, data: { currentBalance: after } });
      const stx = await tx.supplierTransaction.create({
        data: {
          storeId: scope.storeId,
          supplierId: id,
          type: 'PAYMENT',
          amount,
          balanceBefore: before,
          balanceAfter: after,
          notes: input.notes ?? null,
          createdById: scope.actorId,
        },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'large_transaction',
          entityType: 'supplier',
          entityId: id,
          metadata: { amount, balanceBefore: before, balanceAfter: after },
        },
      });
      return stx;
    });
  }
}
