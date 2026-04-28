/**
 * IdempotencyMiddleware — Phase 2 P2-5.
 *
 * Implements RFC-style idempotency for state-changing requests:
 *
 *   1. Activates ONLY for POST / PUT / PATCH / DELETE (safe verbs are
 *      always idempotent).
 *   2. Reads the `Idempotency-Key` header (UUID v4 expected). If absent
 *      → behaves as a no-op (key is optional but recommended).
 *   3. Looks up `IdempotencyKey` in the DB:
 *        • match (same `key`) but different user/endpoint  → 409 CONFLICT
 *        • match + not expired                            → returns the
 *          cached `statusCode` + `response` body (replay safe).
 *        • match + expired                                → deletes the row
 *          and proceeds as a fresh request.
 *        • no match                                       → records the
 *          response after the handler succeeds (2xx only).
 *
 * TTL: 24 hours (per spec).
 *
 * Storage strategy:
 *   • We hook `res.send` once per request to capture the body before the
 *     response leaves the wire.
 *   • Save runs *after* `res.send()` so the client never waits on the DB
 *     write — failures are logged, not surfaced.
 *
 * Thread-safety:
 *   The `IdempotencyKey.key` column has a UNIQUE constraint, so two
 *   concurrent requests with the same key cannot both insert. The second
 *   insert will throw P2002 which we swallow (the first response is
 *   considered authoritative).
 *
 * Notes:
 *   • The middleware runs AFTER `JwtAuthGuard` populates `req.user`, so we
 *     can scope the cache to `userId` (anonymous requests use `null`).
 *   • `req.originalUrl` is used (with the query-string stripped) so the
 *     stored endpoint reflects the real route (e.g. `POST /api/v1/users`)
 *     rather than NestJS-stripped `req.path` (`POST /`).
 */

import { ConflictException, Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { NextFunction, Request, Response } from 'express';

import { PrismaService } from '../../modules/prisma/prisma.service';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const HEADER = 'idempotency-key';

interface AuthRequest extends Request {
  user?: { id: string } & Record<string, unknown>;
}

interface AccessJwtPayload {
  sub: string;
  username: string;
  storeId: string;
  type: 'access';
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Decode the JWT manually (middleware runs *before* JwtAuthGuard, so
   * `req.user` is not yet populated). We don't validate the token's
   * authenticity here — the guard does that — we only need the `sub`
   * claim to scope the idempotency cache to the correct user.
   */
  private extractUserId(req: Request): string | null {
    const auth = req.header('authorization');
    if (!auth?.toLowerCase().startsWith('bearer ')) return null;
    const token = auth.slice(7).trim();
    if (!token) return null;
    try {
      const secret = this.config.get<string>('JWT_ACCESS_SECRET');
      if (!secret) return null;
      const payload = this.jwt.verify<AccessJwtPayload>(token, { secret });
      return payload?.sub ?? null;
    } catch {
      // Invalid token — let the guard handle it. We just don't scope the cache.
      return null;
    }
  }

  async use(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    if (!UNSAFE_METHODS.has(req.method)) {
      return next();
    }

    const headerVal = req.header(HEADER);
    if (!headerVal) {
      // Idempotency-Key is optional — fall through.
      return next();
    }
    const key = headerVal.trim();
    if (key.length < 8 || key.length > 128) {
      // Reject obviously malformed keys silently — handler will see no header.
      return next();
    }

    const userId = this.extractUserId(req);
    const pathOnly = (req.originalUrl ?? req.url ?? '/').split('?')[0];
    const endpoint = `${req.method} ${pathOnly}`;

    // ─── 1. Lookup ──────────────────────────────────────────
    const existing = await this.prisma.idempotencyKey
      .findUnique({ where: { key } })
      .catch(() => null);

    if (existing) {
      // Same key but different user/endpoint → conflict.
      const sameUser = (existing.userId ?? null) === userId;
      const sameEndpoint = existing.endpoint === endpoint;
      if (!sameUser || !sameEndpoint) {
        throw new ConflictException({
          message: 'Idempotency-Key مستخدم لطلب آخر',
          code: 'IDEMPOTENCY_KEY_CONFLICT',
        });
      }
      // Expired → delete and proceed.
      if (existing.expiresAt.getTime() <= Date.now()) {
        await this.prisma.idempotencyKey.delete({ where: { key } }).catch(() => null);
      } else {
        // ─── 2. Replay cached response ────────────────────
        res.setHeader('Idempotent-Replay', 'true');
        res.status(existing.statusCode);
        res.json(existing.response);
        return; // do NOT call next()
      }
    }

    // ─── 3. Capture response body ──────────────────────────
    const originalJson = res.json.bind(res);
    let captured = false;
    res.json = (body: unknown) => {
      const result = originalJson(body);
      if (!captured) {
        captured = true;
        // Only persist successful responses (2xx).
        const statusCode = res.statusCode;
        if (statusCode >= 200 && statusCode < 300) {
          // Fire-and-forget: never block the response.
          this.prisma.idempotencyKey
            .create({
              data: {
                key,
                userId,
                endpoint,
                statusCode,
                response: body as object, // Prisma JSON column accepts any JSON-serialisable value
                expiresAt: new Date(Date.now() + TTL_MS),
              },
            })
            .catch((err: unknown) => {
              const e = err as { code?: string; message?: string };
              // P2002 = unique violation: a concurrent request won the race.
              if (e?.code !== 'P2002') {
                this.logger.warn(`Idempotency save failed: ${e?.message ?? String(err)}`);
              }
            });
        }
      }
      return result;
    };

    return next();
  }
}
