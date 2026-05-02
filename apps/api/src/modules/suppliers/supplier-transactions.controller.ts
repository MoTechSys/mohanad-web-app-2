/**
 * SupplierTransactionsController — Phase 4.
 */
import {
  type CancelSupplierTransactionInput,
  type CreateSupplierAdjustmentInput,
  type CreateSupplierPaymentInput,
  type ListSupplierTransactionsQuery,
  cancelSupplierTransactionSchema,
  createSupplierAdjustmentSchema,
  createSupplierPaymentSchema,
  listSupplierTransactionsQuerySchema,
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
import { SupplierTransactionsService } from './supplier-transactions.service';

@ApiTags('Supplier Transactions')
@ApiBearerAuth('access-token')
@Controller('suppliers/:supplierId/transactions')
export class SupplierTransactionsController {
  constructor(private readonly txService: SupplierTransactionsService) {}

  @Get()
  @RequirePermission('supplier_transactions.view')
  @UsePipes(new ZodValidationPipe(listSupplierTransactionsQuerySchema, 'query'))
  @ApiOperation({ summary: 'حركات حساب التاجر' })
  list(
    @CurrentUser() actor: AuthUser,
    @Param('supplierId') supplierId: string,
    @Query() query: ListSupplierTransactionsQuery,
  ) {
    return this.txService.list({ storeId: actor.storeId, actorId: actor.id }, supplierId, query);
  }

  @Post('payment')
  @RequirePermission('supplier_transactions.create_payment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierPaymentSchema))
  @ApiOperation({ summary: 'تسجيل دفعة للتاجر' })
  createPayment(
    @CurrentUser() actor: AuthUser,
    @Param('supplierId') supplierId: string,
    @Body() body: CreateSupplierPaymentInput,
  ) {
    return this.txService.createPayment(
      { storeId: actor.storeId, actorId: actor.id },
      supplierId,
      body,
    );
  }

  @Post('adjustment')
  @RequirePermission('supplier_transactions.create_adjustment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierAdjustmentSchema))
  @ApiOperation({ summary: 'تسوية رصيد التاجر' })
  createAdjustment(
    @CurrentUser() actor: AuthUser,
    @Param('supplierId') supplierId: string,
    @Body() body: CreateSupplierAdjustmentInput,
  ) {
    return this.txService.createAdjustment(
      { storeId: actor.storeId, actorId: actor.id },
      supplierId,
      body,
    );
  }

  @Post(':txId/cancel')
  @RequirePermission('supplier_transactions.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelSupplierTransactionSchema))
  @ApiOperation({ summary: 'إلغاء حركة تاجر' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('supplierId') supplierId: string,
    @Param('txId') txId: string,
    @Body() body: CancelSupplierTransactionInput,
  ) {
    return this.txService.cancel(
      { storeId: actor.storeId, actorId: actor.id },
      supplierId,
      txId,
      body,
    );
  }
}
