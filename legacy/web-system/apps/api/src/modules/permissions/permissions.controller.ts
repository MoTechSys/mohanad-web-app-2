/**
 * PermissionsController — read-only catalog endpoint.
 *
 * Used by the role editor UI to render the permission tree (grouped by module).
 * Required permission: `permissions.view`.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../auth/decorators/permissions.decorator';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissions: PermissionsService) {}

  @Get()
  @RequirePermission('permissions.view')
  @ApiOperation({ summary: 'كل الصلاحيات (مُجمَّعة حسب الوحدة) — للمُحرِّر' })
  list() {
    return this.permissions.listAll();
  }
}
