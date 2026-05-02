/**
 * SuppliersController — Phase 4.
 */
import {
  type CreateSupplierInput,
  type ListSuppliersQuery,
  type UpdateSupplierInput,
  createSupplierSchema,
  listSuppliersQuerySchema,
  updateSupplierSchema,
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
import { SuppliersService } from './suppliers.service';

@ApiTags('Suppliers')
@ApiBearerAuth('access-token')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission('suppliers.view')
  @UsePipes(new ZodValidationPipe(listSuppliersQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة التجار' })
  list(@CurrentUser() actor: AuthUser, @Query() query: ListSuppliersQuery) {
    return this.suppliers.list({ storeId: actor.storeId, actorId: actor.id }, query);
  }

  @Get(':id')
  @RequirePermission('suppliers.view')
  @ApiOperation({ summary: 'تفاصيل تاجر' })
  findOne(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.findOne({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Get(':id/balance')
  @RequirePermission('suppliers.view_balance')
  @ApiOperation({ summary: 'رصيد التاجر' })
  balance(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.getBalance({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Get(':id/statement')
  @RequirePermission('suppliers.view_transactions')
  @ApiOperation({ summary: 'كشف حساب التاجر' })
  statement(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliers.statement(
      { storeId: actor.storeId, actorId: actor.id },
      id,
      Number(page ?? 1),
      Number(limit ?? 50),
    );
  }

  @Post()
  @RequirePermission('suppliers.create')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createSupplierSchema))
  @ApiOperation({ summary: 'إضافة تاجر جديد' })
  create(@CurrentUser() actor: AuthUser, @Body() body: CreateSupplierInput) {
    return this.suppliers.create({ storeId: actor.storeId, actorId: actor.id }, body);
  }

  @Patch(':id')
  @RequirePermission('suppliers.update')
  @UsePipes(new ZodValidationPipe(updateSupplierSchema))
  @ApiOperation({ summary: 'تعديل بيانات التاجر' })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateSupplierInput,
  ) {
    return this.suppliers.update({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }

  @Delete(':id')
  @RequirePermission('suppliers.delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'حذف التاجر (soft)' })
  remove(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.remove({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  @Post(':id/restore')
  @RequirePermission('suppliers.restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'استعادة التاجر المحذوف' })
  restore(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    return this.suppliers.restore({ storeId: actor.storeId, actorId: actor.id }, id);
  }

  // ─── Record payment ─────────────────────────────────────────
  @Post(':id/transactions/payment')
  @RequirePermission('supplier_transactions.create_payment')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'تسجيل دفعة للمورد' })
  recordPayment(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: { amount: number; notes?: string },
  ) {
    return this.suppliers.recordPayment({ storeId: actor.storeId, actorId: actor.id }, id, body);
  }
}
