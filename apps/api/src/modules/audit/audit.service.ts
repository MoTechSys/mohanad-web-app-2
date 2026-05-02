/**
 * AuditService — Phase 9 (P9-1).
 * Reads & creates audit log entries. Write path is also exposed for
 * programmatic use from other services (e.g. sales, purchases).
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditScope {
  storeId: string;
  actorId: string;
}

export interface CreateAuditInput {
  storeId: string;
  actorId?: string;
  action:
    | 'create'
    | 'update'
    | 'cancel'
    | 'delete'
    | 'restore'
    | 'login'
    | 'login_failed'
    | 'logout';
  entityType: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Programmatic write — call from other services */
  async log(input: CreateAuditInput) {
    return this.prisma.auditLog.create({ data: input as never });
  }

  async list(
    scope: AuditScope,
    query: {
      page?: number;
      limit?: number;
      entityType?: string;
      entityId?: string;
      actorId?: string;
      action?: string;
      dateFrom?: Date;
      dateTo?: Date;
      sortDir?: 'asc' | 'desc';
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      storeId: scope.storeId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: query.sortDir ?? 'desc' },
        include: { actor: { select: { id: true, username: true, fullName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
