import { Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/** Users Module Placeholder (Phase 2). */
@ApiTags('Users')
@Controller('users')
export class UsersController {
  @Get()
  @ApiOperation({ summary: 'GET /api/v1/users (Phase 2)' })
  list(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Post()
  @ApiOperation({ summary: 'POST /api/v1/users (Phase 2)' })
  create(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
