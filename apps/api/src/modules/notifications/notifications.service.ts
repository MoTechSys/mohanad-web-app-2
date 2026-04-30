/**
 * NotificationsService — Phase 3 P3-5.
 *
 * In-app notifications:
 *   • `userId = null` → broadcast to all Owners/Managers in the store.
 *   • Per-user feed: own + broadcasts in the same store.
 *   • Unread count + mark-as-read endpoints power the bell badge.
 */

import { Injectable, NotFoundException } from '@nestjs/common';

import type { ListNotificationsQuery } from '@grocery/shared';

import { PrismaService } from '../prisma/prisma.service';

interface NotifScope {
  storeId: string;
  actorId: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private feedFilter(scope: NotifScope) {
    return {
      storeId: scope.storeId,
      OR: [{ userId: scope.actorId }, { userId: null }],
    };
  }

  // ─── List (paginated) ─────────────────────────────────────
  async list(scope: NotifScope, query: ListNotificationsQuery) {
    const { page, limit, sortDir, type, unreadOnly } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {
      ...this.feedFilter(scope),
      ...(type ? { type } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: sortDir },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Unread count ─────────────────────────────────────────
  async unreadCount(scope: NotifScope) {
    const count = await this.prisma.notification.count({
      where: { ...this.feedFilter(scope), readAt: null },
    });
    return { count };
  }

  // ─── Mark single as read ──────────────────────────────────
  async markRead(scope: NotifScope, id: string) {
    const found = await this.prisma.notification.findFirst({
      where: { id, ...this.feedFilter(scope) },
    });
    if (!found) {
      throw new NotFoundException({
        message: 'الإشعار غير موجود',
        code: 'NOTIFICATION_NOT_FOUND',
      });
    }
    if (found.readAt) return { ok: true, alreadyRead: true };
    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  // ─── Mark all as read ─────────────────────────────────────
  async markAllRead(scope: NotifScope) {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.feedFilter(scope), readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }
}
