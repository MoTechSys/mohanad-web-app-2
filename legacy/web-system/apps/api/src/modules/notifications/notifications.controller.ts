/**
 * NotificationsController — Phase 3 P3-5.
 *
 * Per-user feed + unread count + mark-as-read.
 * `notifications.view_own` is the baseline permission for all read paths;
 * `notifications.mark_read` is required for mutations.
 */

import { type ListNotificationsQuery, listNotificationsQuerySchema } from '@grocery/shared';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private scope(actor: AuthUser) {
    return { storeId: actor.storeId, actorId: actor.id };
  }

  // ─── Feed ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('notifications.view_own')
  @ApiOperation({ summary: 'قائمة الإشعارات (مع ترقيم وفلاتر)' })
  @UsePipes(new ZodValidationPipe(listNotificationsQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListNotificationsQuery) {
    return this.notifications.list(this.scope(actor), query);
  }

  // ─── Unread count ──────────────────────────────────────────
  @Get('unread-count')
  @RequirePermission('notifications.view_own')
  @ApiOperation({ summary: 'عدد الإشعارات غير المقروءة (للجرس)' })
  unreadCount(@CurrentUser() actor: AuthUser) {
    return this.notifications.unreadCount(this.scope(actor));
  }

  // ─── Mark single ───────────────────────────────────────────
  @Post(':id/read')
  @RequirePermission('notifications.mark_read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'وسم إشعار كمقروء' })
  markRead(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(this.scope(actor), id);
  }

  // ─── Mark all ──────────────────────────────────────────────
  @Post('read-all')
  @RequirePermission('notifications.mark_read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'وسم كل الإشعارات كمقروءة' })
  markAllRead(@CurrentUser() actor: AuthUser) {
    return this.notifications.markAllRead(this.scope(actor));
  }
}
