/**
 * CustomersService — Phase 3 P3-3.
 *
 * Responsibilities:
 *   • CRUD on Customers scoped to the caller's storeId.
 *   • Soft-delete via `deletedAt` (read filters use deletedAt: null).
 *   • Freeze / Unfreeze / Grant grace period.
 *   • Set credit-limit (Owner/Manager).
 *   • Statement aggregation (current balance + paginated transactions).
 *   • Opening-balance ledger row created atomically when openingBalance != 0.
 *
 * Conventions:
 *   • All write paths use `prisma.$transaction(async (tx) => {...})`.
 *   • Audit-log rows are appended for every state-changing action.
 *   • Errors carry an Arabic `message` and a stable `code`.
 */

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CreateCustomerInput,
  GrantGraceInput,
  ListCustomersQuery,
  SetCreditLimitInput,
  UpdateCustomerInput,
} from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface CustomerScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List (paginated + search + filter) ───────────────────
  async list(scope: CustomerScope, query: ListCustomersQuery) {
    const { page, limit, search, sortBy, sortDir, status, hasDebt } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(hasDebt ? { currentBalance: { gt: 0 } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { whatsappPhone: { contains: search } },
            ],
          }
        : {}),
    };

    const orderBy = sortBy ? { [sortBy]: sortDir } : { createdAt: sortDir };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          name: true,
          phone: true,
          whatsappPhone: true,
          currentBalance: true,
          creditLimit: true,
          status: true,
          graceUntil: true,
          createdAt: true,
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Detail ────────────────────────────────────────────────
  async findOne(scope: CustomerScope, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      include: {
        createdBy: { select: { id: true, username: true, fullName: true } },
        reminderSettings: true,
      },
    });
    if (!customer) {
      throw new NotFoundException({
        message: 'العميل غير موجود',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }
    return customer;
  }

  // ─── Balance only (used internally + by /balance endpoint) ─
  async getBalance(scope: CustomerScope, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
      select: {
        id: true,
        name: true,
        currentBalance: true,
        openingBalance: true,
        creditLimit: true,
        status: true,
      },
    });
    if (!c) {
      throw new NotFoundException({
        message: 'العميل غير موجود',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }
    return c;
  }

  // ─── Statement (balance + paginated tx) ───────────────────
  async statement(
    scope: CustomerScope,
    id: string,
    page = 1,
    limit = 50,
  ): Promise<{
    customer: Awaited<ReturnType<CustomersService['getBalance']>>;
    items: unknown[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const customer = await this.getBalance(scope, id);
    const skip = (page - 1) * limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customerTransaction.findMany({
        where: { customerId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          createdBy: { select: { id: true, username: true, fullName: true } },
          cancelledBy: { select: { id: true, username: true, fullName: true } },
        },
      }),
      this.prisma.customerTransaction.count({ where: { customerId: id } }),
    ]);
    return {
      customer,
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Create ────────────────────────────────────────────────
  async create(scope: CustomerScope, input: CreateCustomerInput) {
    const opening = Number(input.openingBalance ?? 0);
    const creditLimit = input.creditLimit !== undefined ? Number(input.creditLimit) : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          storeId: scope.storeId,
          name: input.name,
          phone: input.phone ?? null,
          whatsappPhone: input.whatsappPhone ?? null,
          address: input.address ?? null,
          notes: input.notes ?? null,
          openingBalance: opening,
          currentBalance: opening,
          creditLimit,
          createdById: scope.actorId,
        },
      });
      // opening-balance ledger row when != 0
      if (opening !== 0) {
        await tx.customerTransaction.create({
          data: {
            customerId: customer.id,
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
          entityType: 'customer',
          entityId: customer.id,
          newValues: {
            name: customer.name,
            openingBalance: opening,
            creditLimit,
          },
        },
      });
      return customer;
    });
    return this.findOne(scope, created.id);
  }

  // ─── Update ────────────────────────────────────────────────
  async update(scope: CustomerScope, id: string, input: UpdateCustomerInput) {
    const before = await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone ?? null } : {}),
          ...(input.whatsappPhone !== undefined
            ? { whatsappPhone: input.whatsappPhone ?? null }
            : {}),
          ...(input.address !== undefined ? { address: input.address ?? null } : {}),
          ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer',
          entityId: id,
          oldValues: { name: before.name, phone: before.phone },
          newValues: { ...input },
        },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Soft delete ───────────────────────────────────────────
  async remove(scope: CustomerScope, id: string) {
    const before = await this.assertExists(scope, id);
    if (Number(before.currentBalance) !== 0) {
      throw new ConflictException({
        message: 'لا يمكن حذف عميل لديه رصيد غير صفر',
        code: 'CUSTOMER_HAS_BALANCE',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'delete',
          entityType: 'customer',
          entityId: id,
        },
      });
    });
    return { ok: true };
  }

  // ─── Freeze / Unfreeze ─────────────────────────────────────
  async freeze(scope: CustomerScope, id: string) {
    await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { status: 'FROZEN' },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer',
          entityId: id,
          metadata: { status: 'FROZEN' },
        },
      });
    });
    return this.findOne(scope, id);
  }

  async unfreeze(scope: CustomerScope, id: string) {
    await this.assertExists(scope, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { status: 'ACTIVE', graceUntil: null },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer',
          entityId: id,
          metadata: { status: 'ACTIVE' },
        },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Grant grace period ───────────────────────────────────
  async grantGrace(scope: CustomerScope, id: string, input: GrantGraceInput) {
    await this.assertExists(scope, id);
    if (input.graceUntil <= new Date()) {
      throw new BadRequestException({
        message: 'تاريخ المهلة يجب أن يكون في المستقبل',
        code: 'INVALID_GRACE_DATE',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { status: 'GRACE_PERIOD', graceUntil: input.graceUntil },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer',
          entityId: id,
          metadata: { graceUntil: input.graceUntil.toISOString() },
        },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Set credit limit ──────────────────────────────────────
  async setCreditLimit(scope: CustomerScope, id: string, input: SetCreditLimitInput) {
    const before = await this.assertExists(scope, id);
    const value = input.creditLimit === null ? null : Number(input.creditLimit);
    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: { creditLimit: value },
      });
      await tx.auditLog.create({
        data: {
          storeId: scope.storeId,
          actorId: scope.actorId,
          action: 'update',
          entityType: 'customer',
          entityId: id,
          oldValues: { creditLimit: before.creditLimit },
          newValues: { creditLimit: value },
        },
      });
    });
    return this.findOne(scope, id);
  }

  // ─── Helper ────────────────────────────────────────────────
  private async assertExists(scope: CustomerScope, id: string) {
    const c = await this.prisma.customer.findFirst({
      where: { id, storeId: scope.storeId, deletedAt: null },
    });
    if (!c) {
      throw new NotFoundException({
        message: 'العميل غير موجود',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }
    return c;
  }
}
