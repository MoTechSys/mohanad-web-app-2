import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/** Roles Module Placeholder (Phase 2). */
@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  @Get()
  @ApiOperation({ summary: 'GET /api/v1/roles (Phase 2)' })
  list(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
