/**
 * AuditController — Phase 9 (P9-1).
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/permissions.decorator';
import type { AuthUser } from '../auth/types/auth-user';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  private scope(user: AuthUser) {
    return { storeId: user.storeId, actorId: user.id };
  }

  @Get()
  @RequirePermission('audit_logs.view')
  @ApiOperation({ summary: 'سجل المراجعة (audit log)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
    @Query('actorId') actorId: string,
    @Query('action') action: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('sortDir') sortDir: string,
  ) {
    return this.svc.list(this.scope(user), {
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 20,
      entityType: entityType || undefined,
      entityId: entityId || undefined,
      actorId: actorId || undefined,
      action: action || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      sortDir: (sortDir as 'asc' | 'desc') || 'desc',
    });
  }
}
