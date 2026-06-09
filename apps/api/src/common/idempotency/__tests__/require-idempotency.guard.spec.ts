/**
 * RequireIdempotencyGuard — Jest spec.
 *
 * Golden rule #9: money-mutating POST endpoints decorated with
 * @RequireIdempotency() must carry a well-formed Idempotency-Key header,
 * otherwise the guard rejects with 400. Undecorated routes pass through.
 */
import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_IDEMPOTENCY_KEY } from '../require-idempotency.decorator';
import { RequireIdempotencyGuard } from '../require-idempotency.guard';

const buildCtx = (headerVal: string | undefined): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name.toLowerCase() === 'idempotency-key' ? headerVal : undefined,
      }),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (required: boolean): RequireIdempotencyGuard => {
  const reflector = {
    getAllAndOverride: (key: string) => (key === REQUIRE_IDEMPOTENCY_KEY ? required : undefined),
  } as unknown as Reflector;
  return new RequireIdempotencyGuard(reflector);
};

describe('RequireIdempotencyGuard', () => {
  it('passes through routes that do not require idempotency', () => {
    expect(guardWith(false).canActivate(buildCtx(undefined))).toBe(true);
  });

  it('rejects a required route with no key (400 + IDEMPOTENCY_KEY_REQUIRED)', () => {
    const guard = guardWith(true);
    try {
      guard.canActivate(buildCtx(undefined));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const res = (e as BadRequestException).getResponse() as { code: string };
      expect(res.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    }
  });

  it('rejects a too-short key (400 + IDEMPOTENCY_KEY_INVALID)', () => {
    const guard = guardWith(true);
    try {
      guard.canActivate(buildCtx('short'));
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      const res = (e as BadRequestException).getResponse() as { code: string };
      expect(res.code).toBe('IDEMPOTENCY_KEY_INVALID');
    }
  });

  it('accepts a well-formed key on a required route', () => {
    expect(guardWith(true).canActivate(buildCtx('a-valid-idempotency-key-1234'))).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(guardWith(true).canActivate(buildCtx('   a-valid-key-1234   '))).toBe(true);
  });
});
