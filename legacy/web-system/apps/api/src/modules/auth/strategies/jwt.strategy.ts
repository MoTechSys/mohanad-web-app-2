import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../types/auth-user';

/**
 * JwtStrategy — validates `Authorization: Bearer <access-token>` headers.
 *
 * On success it loads the *current* user (with active roles & permissions)
 * from the database, so revoked roles or deactivated accounts are rejected
 * within the lifetime of an access token (≤ 15 min) without waiting for
 * the next refresh.
 */
export interface JwtAccessPayload {
  /** User id (cuid). */
  sub: string;
  username: string;
  storeId: string;
  /** Discriminator — refresh tokens reuse the JWT format with type='refresh'. */
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        message: 'نوع التوكن غير صحيح',
        code: 'INVALID_TOKEN_TYPE',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException({
        message: 'الحساب غير نشط',
        code: 'USER_INACTIVE',
      });
    }

    // Compute effective permission set + role keys.
    const permissions = new Set<string>();
    const roles: string[] = [];
    for (const ur of user.userRoles) {
      if (!ur.role.isActive) continue;
      roles.push(ur.role.key);
      for (const rp of ur.role.rolePermissions) {
        permissions.add(rp.permission.key);
      }
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      storeId: user.storeId,
      permissions: [...permissions],
      roles,
    };
  }
}
