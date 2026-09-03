/**
 * ReportsController — Phase 6 (P6-2).
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  private scope(user: AuthUser) {
    return { storeId: user.storeId, actorId: user.id };
  }

  @Get('dashboard')
  @RequirePermission('reports.dashboard.view')
  @ApiOperation({ summary: 'لوحة تحكم اليوم' })
  dashboard(@CurrentUser() user: AuthUser) {
    return this.svc.dashboard(this.scope(user));
  }

  @Get('daily-summary')
  @RequirePermission('reports.daily_summary.view')
  @ApiOperation({ summary: 'ملخص يومي لفترة' })
  dailySummary(
    @CurrentUser() user: AuthUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo ? new Date(dateTo) : new Date();
    return this.svc.dailySummary(this.scope(user), from, to);
  }

  @Get('top-debtors')
  @RequirePermission('reports.customer_debts.view')
  @ApiOperation({ summary: 'أعلى العملاء مديونية' })
  topDebtors(@CurrentUser() user: AuthUser, @Query('limit') limit: string) {
    return this.svc.topDebtors(this.scope(user), limit ? Number.parseInt(limit, 10) : 10);
  }

  @Get('top-supplier-debts')
  @RequirePermission('reports.supplier_debts.view')
  @ApiOperation({ summary: 'أعلى التجار مديونية' })
  topSupplierDebts(@CurrentUser() user: AuthUser, @Query('limit') limit: string) {
    return this.svc.topSupplierDebts(this.scope(user), limit ? Number.parseInt(limit, 10) : 10);
  }

  @Get('top-products')
  @RequirePermission('reports.sales.view')
  @ApiOperation({ summary: 'أكثر المنتجات مبيعاً' })
  topProducts(
    @CurrentUser() user: AuthUser,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('limit') limit: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : new Date(new Date().setHours(0, 0, 0, 0));
    const to = dateTo ? new Date(dateTo) : new Date();
    return this.svc.topProducts(
      this.scope(user),
      from,
      to,
      limit ? Number.parseInt(limit, 10) : 10,
    );
  }
}
