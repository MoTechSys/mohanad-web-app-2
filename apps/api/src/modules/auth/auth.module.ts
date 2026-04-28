import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * AuthModule placeholder. Real providers (JwtStrategy, AuthService, etc.)
 * will be added in Phase 2.
 */
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
