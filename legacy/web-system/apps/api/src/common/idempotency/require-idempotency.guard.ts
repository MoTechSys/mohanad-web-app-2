import {
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { REQUIRE_IDEMPOTENCY_KEY } from './require-idempotency.decorator';

const HEADER = 'idempotency-key';
const MIN_LEN = 8;
const MAX_LEN = 128;

/**
 * Enforces the presence of a well-formed `Idempotency-Key` header on routes
 * decorated with {@link RequireIdempotency}. This guarantees golden rule #9:
 * every money-mutating POST must carry an idempotency key so a retried
 * request can never double-charge a balance.
 *
 * The actual replay/caching is handled by IdempotencyMiddleware; this guard
 * only rejects requests that omit (or malform) the key with 400.
 */
@Injectable()
export class RequireIdempotencyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_IDEMPOTENCY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.header(HEADER);
    const key = raw?.trim();
    if (!key) {
      throw new BadRequestException({
        message: 'ترويسة Idempotency-Key مطلوبة لهذه العملية',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }
    if (key.length < MIN_LEN || key.length > MAX_LEN) {
      throw new BadRequestException({
        message: `Idempotency-Key يجب أن يكون بين ${MIN_LEN} و${MAX_LEN} حرفاً`,
        code: 'IDEMPOTENCY_KEY_INVALID',
      });
    }
    return true;
  }
}
