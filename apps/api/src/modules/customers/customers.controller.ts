/**
 * CustomersController — Phase 3 P3-3.
 *
 * All endpoints require authentication (global JwtAuthGuard) AND a specific
 * permission via `@RequirePermission(...)`.
 */

import {
  type CreateCustomerInput,
  type GrantGraceInput,
  type ListCustomersQuery,
  type SetCreditLimitInput,
  type UpdateCustomerInput,
  createCustomerSchema,
  grantGraceSchema,
  listCustomersQuerySchema,
  setCreditLimitSchema,
  updateCustomerSchema,
} from '@grocery/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { CustomersService } from './customers.service';

@ApiTags('Customers')
@ApiBearerAuth('access-token')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // ─── List ──────────────────────────────────────────────────
  @Get()
  @RequirePermission('customers.view')
  @ApiOperation({ summary: 'قائمة العملاء (بحث + ترقيم + فلاتر)' })
  @UsePipes(new ZodValidationPipe(listCustomersQuerySchema, 'query'))
  list(@CurrentUser() actor: AuthUser, @Query() query: ListCustomersQuery) {
    return this.customers.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  // ─── Detail ────────────────────────────────────────────────
  @Get(':id')
  @RequirePermission('customers.view')
  @ApiOperation({ summary: 'تفاصيل عميل' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.customers.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Balance ───────────────────────────────────────────────
  @Get(':id/balance')
  @RequirePermission('customers.view_balance')
  @ApiOperation({ summary: 'رصيد العميل (مختصر)' })
  balance(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.customers.getBalance({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Statement ─────────────────────────────────────────────
  @Get(':id/statement')
  @RequirePermission('customers.view_transactions')
  @ApiOperation({ summary: 'كشف حساب العميل' })
  statement(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customers.statement(
      { storeId: actor.storeId, actorId: actor.id },
      id,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  // ─── Create ────────────────────────────────────────────────
  @Post()
  @RequirePermission('customers.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createCustomerSchema))
  @ApiOperation({ summary: 'إنشاء عميل جديد + رصيد افتتاحي اختياري' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateCustomerInput) {
    return this.customers.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  // ─── Update ────────────────────────────────────────────────
  @Patch(':id')
  @RequirePermission('customers.update')
  @UsePipes(new ZodValidationPipe(updateCustomerSchema))
  @ApiOperation({ summary: 'تعديل بيانات العميل' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCustomerInput,
  ) {
    return this.customers.update({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Soft delete ───────────────────────────────────────────
  @Delete(':id')
  @RequirePermission('customers.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف العميل (soft delete) — ممنوع لو الرصيد ≠ 0' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.customers.remove({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Freeze ────────────────────────────────────────────────
  @Post(':id/freeze')
  @RequirePermission('customers.freeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تجميد العميل — يمنع تسجيل ديون جديدة' })
  freeze(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.customers.freeze({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Unfreeze ──────────────────────────────────────────────
  @Post(':id/unfreeze')
  @RequirePermission('customers.unfreeze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'إلغاء تجميد العميل' })
  unfreeze(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.customers.unfreeze({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Grant grace ───────────────────────────────────────────
  @Post(':id/grant-grace')
  @RequirePermission('customers.grant_grace')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(grantGraceSchema))
  @ApiOperation({ summary: 'منح مهلة سداد — تاريخ مستقبلي' })
  grantGrace(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: GrantGraceInput,
  ) {
    return this.customers.grantGrace({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  // ─── Credit limit ──────────────────────────────────────────
  @Post(':id/credit-limit')
  @RequirePermission('customers.set_credit_limit')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(setCreditLimitSchema))
  @ApiOperation({ summary: 'تحديد سقف الدين' })
  setCreditLimit(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: SetCreditLimitInput,
  ) {
    return this.customers.setCreditLimit({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }
}
// NOTE: customer payment lives in CustomerTransactionsController
// (POST /customers/:id/transactions/payment) — the previous duplicate
// recordPayment route here collided with it and bypassed Zod validation +
// row-locking, so it was removed.
