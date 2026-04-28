import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RefreshToken } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtAccessPayload } from './strategies/jwt.strategy';

/**
 * Refresh token payload (JWT body — opaque to clients).
 * The actual JWT is sent ONLY in an httpOnly cookie; only its SHA-256 hash
 * is stored in the DB so a DB leak doesn't reveal valid sessions.
 */
export interface JwtRefreshPayload {
  sub: string;
  storeId: string;
  /** Random per-token id; lets us blacklist a single token without rotating secrets. */
  jti: string;
  type: 'refresh';
}

/** Convert "15m" / "7d" / "30d" to seconds. Fallback: numeric seconds string. */
export function ttlToSeconds(ttl: string): number {
  const m = ttl.match(/^(\d+)\s*([smhd])?$/i);
  if (!m) {
    const n = Number(ttl);
    return Number.isFinite(n) ? n : 900; // default 15m
  }
  const value = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  const factors = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return value * factors[unit as keyof typeof factors];
}

export const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex');

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ─── Access token ─────────────────────────────────────────────
  async signAccessToken(input: { userId: string; username: string; storeId: string }): Promise<{
    token: string;
    expiresInSec: number;
  }> {
    const ttl = this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
    const secret = this.config.get<string>('JWT_ACCESS_SECRET') as string;
    const expiresInSec = ttlToSeconds(ttl);
    const payload: JwtAccessPayload = {
      sub: input.userId,
      username: input.username,
      storeId: input.storeId,
      type: 'access',
    };
    const token = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresInSec,
    });
    return { token, expiresInSec };
  }

  // ─── Refresh token (issue) ────────────────────────────────────
  async issueRefreshToken(input: {
    userId: string;
    storeId: string;
    rememberMe: boolean;
    deviceLabel?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ token: string; expiresAt: Date; row: RefreshToken }> {
    const ttlString = input.rememberMe
      ? (this.config.get<string>('JWT_REFRESH_TTL_REMEMBER_ME') ?? '30d')
      : (this.config.get<string>('JWT_REFRESH_TTL') ?? '7d');
    const ttlSec = ttlToSeconds(ttlString);
    const secret = this.config.get<string>('JWT_REFRESH_SECRET') as string;
    const jti = randomUUID();

    const payload: JwtRefreshPayload = {
      sub: input.userId,
      storeId: input.storeId,
      jti,
      type: 'refresh',
    };
    const token = await this.jwt.signAsync(payload, {
      secret,
      expiresIn: ttlSec,
    });
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    const tokenHash = sha256(token);

    const row = await this.prisma.refreshToken.create({
      data: {
        userId: input.userId,
        tokenHash,
        deviceLabel: input.deviceLabel ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        rememberMe: input.rememberMe,
        expiresAt,
      },
    });

    return { token, expiresAt, row };
  }

  // ─── Refresh token (verify) ───────────────────────────────────
  async verifyRefreshToken(token: string): Promise<{
    payload: JwtRefreshPayload;
    row: RefreshToken;
  }> {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET') as string;
    // 1. JWT signature + expiry
    const payload = await this.jwt.verifyAsync<JwtRefreshPayload>(token, { secret });
    if (payload.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }
    // 2. DB lookup by hash
    const tokenHash = sha256(token);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!row) throw new Error('REFRESH_TOKEN_UNKNOWN');
    if (row.revokedAt) throw new Error('REFRESH_TOKEN_REVOKED');
    if (row.expiresAt.getTime() < Date.now()) throw new Error('REFRESH_TOKEN_EXPIRED');
    return { payload, row };
  }

  // ─── Revocation ───────────────────────────────────────────────
  async revokeByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count;
  }

  // ─── Cleanup expired ─────────────────────────────────────────
  async cleanupExpired(userId?: string): Promise<number> {
    const res = await this.prisma.refreshToken.deleteMany({
      where: {
        ...(userId ? { userId } : {}),
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
    return res.count;
  }
}
