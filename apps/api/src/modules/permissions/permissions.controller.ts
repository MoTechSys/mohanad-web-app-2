import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/** Permissions Module Placeholder (Phase 2). */
@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  @Get()
  @ApiOperation({ summary: 'GET /api/v1/permissions (Phase 2)' })
  list(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
