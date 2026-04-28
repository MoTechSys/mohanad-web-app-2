import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

/**
 * AuthModule — Phase 2 (Auth + RBAC).
 *
 * Registers JwtAuthGuard and PermissionsGuard as APP_GUARDs so every
 * route is authenticated by default. Routes can opt-out via @Public().
 *
 * NOTE: APP_GUARD ordering is execution order: Throttler (from AppModule)
 * → JwtAuthGuard → PermissionsGuard. PermissionsGuard runs after auth so
 * `request.user` is guaranteed to be populated.
 */
@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // JwtModule is configured per-call via signAsync(payload, { secret, expiresIn })
    // in TokenService, so we register it without defaults — the secret rotates
    // between access (JWT_ACCESS_SECRET) and refresh (JWT_REFRESH_SECRET) tokens.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: () => ({}),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService, TokenService, JwtStrategy],
})
export class AuthModule {}
