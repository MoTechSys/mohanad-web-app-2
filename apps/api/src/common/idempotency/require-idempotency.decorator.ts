import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key flagging a route handler as requiring an `Idempotency-Key`
 * header. Enforced by {@link RequireIdempotencyGuard}.
 *
 * Golden rule #9 (docs/12-agent-memory.md): the header is MANDATORY on the
 * five money-mutating POST endpoints (sales, customer-transactions,
 * supplier-transactions, expenses, purchases). Elsewhere the key stays
 * optional (handled by IdempotencyMiddleware).
 */
export const REQUIRE_IDEMPOTENCY_KEY = 'require_idempotency';

export const RequireIdempotency = (): MethodDecorator => SetMetadata(REQUIRE_IDEMPOTENCY_KEY, true);
