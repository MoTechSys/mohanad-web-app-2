/**
 * PurchasesController — Phase 4.
 */
import {
  type CancelPurchaseInput,
  type CreatePurchaseInput,
  type ListPurchasesQuery,
  cancelPurchaseSchema,
  createPurchaseSchema,
  listPurchasesQuerySchema,
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
import { PurchasesService } from './purchases.service';

@ApiTags('Purchases')
@ApiBearerAuth('access-token')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @RequirePermission('purchases.view')
  @UsePipes(new ZodValidationPipe(listPurchasesQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة المشتريات' })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListPurchasesQuery) {
    return this.purchases.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  @Get(':id')
  @RequirePermission('purchases.view')
  @ApiOperation({ summary: 'تفاصيل فاتورة شراء' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.purchases.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Post()
  @RequireIdempotency()
  @RequirePermission('purchases.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createPurchaseSchema))
  @ApiOperation({ summary: 'تسجيل فاتورة شراء جديدة (إجمالي أو تفصيلي، نقدي أو آجل)' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreatePurchaseInput) {
    return this.purchases.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  @Post(':id/cancel')
  @RequirePermission('purchases.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelPurchaseSchema))
  @ApiOperation({ summary: 'إلغاء فاتورة شراء — يعكس أثر التاجر والمصاريف' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelPurchaseInput,
  ) {
    return this.purchases.cancel({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }
}
