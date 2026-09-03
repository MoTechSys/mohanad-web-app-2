/**
 * InventoryController — Phase 7 (P7-1).
 */
import {
  type CancelStockMovementInput,
  type CreateStockMovementInput,
  type ListStockMovementsQuery,
  cancelStockMovementSchema,
  createStockMovementSchema,
  listStockMovementsQuerySchema,
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
import { InventoryService } from './inventory.service';

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  private scope(user: AuthUser) {
    return { storeId: user.storeId, actorId: user.id };
  }

  @Get('movements')
  @RequirePermission('stock_movements.view')
  @UsePipes(new ZodValidationPipe(listStockMovementsQuerySchema, 'query'))
  @ApiOperation({ summary: 'قائمة حركات المخزون' })
  listMovements(@CurrentUser() user: AuthUser, @Query() query: ListStockMovementsQuery) {
    return this.svc.listMovements(this.scope(user), query);
  }

  @Get('stats')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'إحصائيات المخزون' })
  stats(@CurrentUser() user: AuthUser) {
    return this.svc.inventoryStats(this.scope(user));
  }

  @Get('low-stock')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'منتجات على وشك النفاد' })
  lowStock(@CurrentUser() user: AuthUser) {
    return this.svc.lowStockProducts(this.scope(user));
  }

  @Get('products/:productId')
  @RequirePermission('inventory.view')
  @ApiOperation({ summary: 'بطاقة مخزون منتج' })
  productCard(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.svc.productCard(this.scope(user), productId);
  }

  @Post('movements')
  @RequirePermission('stock_movements.adjust')
  @UsePipes(new ZodValidationPipe(createStockMovementSchema))
  @ApiOperation({ summary: 'تسجيل حركة مخزون يدوية' })
  createMovement(@CurrentUser() user: AuthUser, @Body() body: CreateStockMovementInput) {
    return this.svc.createMovement(this.scope(user), body);
  }

  @Post('movements/:id/cancel')
  @RequirePermission('stock_movements.cancel')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(cancelStockMovementSchema))
  @ApiOperation({ summary: 'إلغاء حركة مخزون' })
  cancelMovement(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CancelStockMovementInput,
  ) {
    return this.svc.cancelMovement(this.scope(user), id, body);
  }
}
