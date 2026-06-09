/**
 * DailyIncomeController — Phase 6 (P6-1).
 */
import {
  type CancelDailyIncomeInput,
  type CreateDailyIncomeInput,
  type ListDailyIncomeQuery,
  cancelDailyIncomeSchema,
  createDailyIncomeSchema,
  listDailyIncomeQuerySchema,
} from '@grocery/shared';
import {
  Body,
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
import { DailyIncomeService } from './daily-income.service';

@ApiTags('Daily Income')
@ApiBearerAuth('access-token')
@Controller('daily-income')
export class DailyIncomeController {
  constructor(private readonly svc: DailyIncomeService) {}

  private scope(user: AuthUser) {
    return { storeId: user.storeId, actorId: user.id };
  }

  @Get()
  @RequirePermission('daily_income.view')
  @UsePipes(new ZodValidationPipe(listDailyIncomeQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة الإيرادات اليومية' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListDailyIncomeQuery) {
    return this.svc.list(this.scope(user), query);
  }

  @Get('stats/today')
  @RequirePermission('daily_income.view')
  @ApiOperation({ summary: 'ملخص إيرادات اليوم' })
  todayStats(@CurrentUser() user: AuthUser) {
    return this.svc.todayStats(this.scope(user));
  }

  @Get(':id')
  @RequirePermission('daily_income.view')
  @ApiOperation({ summary: 'تفاصيل سجل إيراد' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.findOne(this.scope(user), id);
  }

  @Post()
  @RequirePermission('daily_income.create')
  @UsePipes(new ZodValidationPipe(createDailyIncomeSchema))
  @ApiOperation({ summary: 'تسجيل إيراد يومي جديد' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateDailyIncomeInput) {
    return this.svc.create(this.scope(user), body);
  }

  @Post(':id/approve')
  @RequirePermission('daily_income.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'اعتماد سجل إيراد' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.approve(this.scope(user), id);
  }

  @Post(':id/cancel')
  @RequirePermission('daily_income.delete')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelDailyIncomeSchema))
  @ApiOperation({ summary: 'إلغاء سجل إيراد' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelDailyIncomeInput,
  ) {
    return this.svc.cancel(this.scope(user), id, body);
  }
}
