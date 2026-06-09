/**
 * SalesController — Phase 5.
 */
import {
  type CancelSaleInput,
  type CreateSaleInput,
  type ListSalesQuery,
  cancelSaleSchema,
  createSaleSchema,
  listSalesQuerySchema,
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
import { RequireIdempotency } from '../../common/idempotency/require-idempotency.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth('access-token')
@Controller('sales')
export class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get()
  @RequirePermission('sales.view')
  @UsePipes(new ZodValidationPipe(listSalesQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة فواتير البيع' })
  list(@CurrentUser() user: AuthUser, @Query() query: ListSalesQuery) {
    return this.svc.list({ storeId: user.storeId, actorId: user.id }, query);
  }

  @Get('stats/today')
  @RequirePermission('sales.view')
  @ApiOperation({ summary: 'ملخص مبيعات اليوم' })
  todayStats(@CurrentUser() user: AuthUser) {
    return this.svc.todayStats({ storeId: user.storeId, actorId: user.id });
  }

  @Get(':id')
  @RequirePermission('sales.view')
  @ApiOperation({ summary: 'تفاصيل فاتورة بيع' })
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.findOne({ storeId: user.storeId, actorId: user.id }, id);
  }

  @Post()
  @RequireIdempotency()
  @RequirePermission('sales.create')
  @UsePipes(new ZodValidationPipe(createSaleSchema))
  @ApiOperation({ summary: 'إنشاء فاتورة بيع جديدة' })
  create(@CurrentUser() user: AuthUser, @Body() body: CreateSaleInput) {
    return this.svc.create({ storeId: user.storeId, actorId: user.id }, body);
  }

  @Post(':id/cancel')
  @RequirePermission('sales.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelSaleSchema))
  @ApiOperation({ summary: 'إلغاء فاتورة بيع' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: CancelSaleInput) {
    return this.svc.cancel({ storeId: user.storeId, actorId: user.id }, id, body);
  }
}
