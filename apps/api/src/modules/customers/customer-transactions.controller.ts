/**
 * CustomerTransactionsController — Phase 3 P3-4.
 *
 * Routes are nested under /customers/:id/transactions to keep the URL space
 * descriptive and aligned with docs/03 (financial flows).
 */

import {
  type CancelTransactionInput,
  type CreateAdjustmentInput,
  type CreateDebtInput,
  type CreatePaymentInput,
  type ListTransactionsQuery,
  cancelTransactionSchema,
  createAdjustmentSchema,
  createDebtSchema,
  createPaymentSchema,
  listTransactionsQuerySchema,
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
import { CustomerTransactionsService } from './customer-transactions.service';

@ApiTags('Customer Transactions')
@ApiBearerAuth('access-token')
@Controller('customers/:id/transactions')
export class CustomerTransactionsController {
  constructor(private readonly tx: CustomerTransactionsService) {}

  private scope(actor: AuthUser) {
    return {
      storeId: actor.storeId,
      actorId: actor.id,
      permissions: actor.permissions ?? [],
    };
  }

  // ─── List ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('customer_transactions.view')
  @ApiOperation({ summary: 'حركات حساب العميل (دين/سداد/تسوية/افتتاح)' })
  @UsePipes(new ZodValidationPipe(listTransactionsQuerySchema, 'query'))
  list(
    @CurrentUser() actor: AuthUser,
    @Param('id') customerId: string,
    @Query() query: ListTransactionsQuery,
  ) {
    return this.tx.list(this.scope(actor), customerId, query);
  }

  // ─── Create DEBT ───────────────────────────────────────────
  @Post('debt')
  @RequireIdempotency()
  @RequirePermission('customer_transactions.create_debt')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createDebtSchema))
  @ApiOperation({ summary: 'تسجيل دين على العميل (atomic)' })
  createDebt(
    @CurrentUser() actor: AuthUser,
    @Param('id') customerId: string,
    @Body() body: CreateDebtInput,
  ) {
    return this.tx.createDebt(this.scope(actor), customerId, body);
  }

  // ─── Create PAYMENT ────────────────────────────────────────
  @Post('payment')
  @RequireIdempotency()
  @RequirePermission('customer_transactions.create_payment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createPaymentSchema))
  @ApiOperation({ summary: 'تسجيل سداد من العميل (atomic)' })
  createPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id') customerId: string,
    @Body() body: CreatePaymentInput,
  ) {
    return this.tx.createPayment(this.scope(actor), customerId, body);
  }

  // ─── Create ADJUSTMENT ────────────────────────────────────
  @Post('adjustment')
  @RequireIdempotency()
  @RequirePermission('customer_transactions.create_adjustment')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createAdjustmentSchema))
  @ApiOperation({ summary: 'تسوية رصيد العميل (موجبة/سالبة + سبب إجباري)' })
  createAdjustment(
    @CurrentUser() actor: AuthUser,
    @Param('id') customerId: string,
    @Body() body: CreateAdjustmentInput,
  ) {
    return this.tx.createAdjustment(this.scope(actor), customerId, body);
  }

  // ─── Cancel ────────────────────────────────────────────────
  @Post(':txId/cancel')
  @RequirePermission('customer_transactions.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelTransactionSchema))
  @ApiOperation({ summary: 'إلغاء حركة (ينعكس الرصيد + audit log)' })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id') customerId: string,
    @Param('txId') txId: string,
    @Body() body: CancelTransactionInput,
  ) {
    return this.tx.cancel(this.scope(actor), customerId, txId, body);
  }
}
