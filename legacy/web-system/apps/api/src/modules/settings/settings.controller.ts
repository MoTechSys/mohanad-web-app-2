/**
 * SettingsController — Phase 8 (P8-1).
 */
import {
  type UpsertCustomerReminderInput,
  type UpsertSettingInput,
  upsertCustomerReminderSchema,
  upsertSettingSchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth('access-token')
@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  private scope(user: AuthUser) {
    return { storeId: user.storeId, actorId: user.id };
  }

  // ─── Store settings ────────────────────────────────────────
  @Get()
  @RequirePermission('system.settings.view')
  @ApiOperation({ summary: 'جميع إعدادات المتجر' })
  getAll(@CurrentUser() user: AuthUser) {
    return this.svc.getAll(this.scope(user));
  }

  @Get(':key')
  @RequirePermission('system.settings.view')
  @ApiOperation({ summary: 'قيمة إعداد واحد' })
  async getByKey(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    const value = await this.svc.getByKey(this.scope(user), key);
    if (value === null) throw new NotFoundException('الإعداد غير موجود');
    return { key, value };
  }

  @Put()
  @RequirePermission('system.settings.update')
  @UsePipes(new ZodValidationPipe(upsertSettingSchema))
  @ApiOperation({ summary: 'حفظ أو تحديث إعداد' })
  upsert(@CurrentUser() user: AuthUser, @Body() body: UpsertSettingInput) {
    return this.svc.upsert(this.scope(user), body);
  }

  @Delete(':key')
  @RequirePermission('system.settings.update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف إعداد' })
  delete(@CurrentUser() user: AuthUser, @Param('key') key: string) {
    return this.svc.delete(this.scope(user), key);
  }

  // ─── Customer reminder settings ────────────────────────────
  @Get('customer-reminders/list')
  @RequirePermission('notifications.manage_settings')
  @ApiOperation({ summary: 'قائمة عملاء مفعّل لهم التذكير' })
  listReminders(@CurrentUser() user: AuthUser) {
    return this.svc.listCustomerReminders(this.scope(user));
  }

  @Get('customer-reminders/:customerId')
  @RequirePermission('notifications.manage_settings')
  @ApiOperation({ summary: 'إعدادات تذكير عميل محدد' })
  getReminder(@CurrentUser() user: AuthUser, @Param('customerId') customerId: string) {
    return this.svc.getCustomerReminder(this.scope(user), customerId);
  }

  @Put('customer-reminders/:customerId')
  @RequirePermission('notifications.manage_settings')
  @UsePipes(new ZodValidationPipe(upsertCustomerReminderSchema))
  @ApiOperation({ summary: 'تفعيل / تعديل تذكير عميل' })
  upsertReminder(
    @CurrentUser() user: AuthUser,
    @Param('customerId') customerId: string,
    @Body() body: UpsertCustomerReminderInput,
  ) {
    return this.svc.upsertCustomerReminder(this.scope(user), customerId, body);
  }
}
