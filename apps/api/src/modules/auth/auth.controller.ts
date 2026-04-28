import { Controller, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * Auth Module Placeholder (Phase 2)
 *
 * Real JWT login / refresh / logout will be implemented in Phase 2.
 * Foundation only declares the surface so the OpenAPI doc shows the
 * future routes (returning 501 Not Implemented).
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: 'POST /api/v1/auth/login (Phase 2)' })
  login(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2 (Auth)', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: 'POST /api/v1/auth/refresh (Phase 2)' })
  refresh(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2 (Auth)', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: 'POST /api/v1/auth/logout (Phase 2)' })
  logout(): never {
    throw new HttpException(
      { message: 'سيتم تفعيله في المرحلة 2 (Auth)', code: 'NOT_IMPLEMENTED' },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
