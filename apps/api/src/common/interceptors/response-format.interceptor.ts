import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { type Observable, map } from 'rxjs';

/**
 * Base Response Format
 * --------------------
 * Wraps every successful controller payload in a unified envelope:
 *
 *   { data: <payload>, meta: { requestId, timestamp, version } }
 *
 * If a controller already returns an object containing a `data` key
 * (intentional override), the payload is passed through untouched
 * so consumers can shape pagination/meta themselves.
 *
 * Errors are not handled here — `AllExceptionsFilter` formats those.
 */
@Injectable()
export class ResponseFormatInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? null;
    const version = process.env.APP_VERSION ?? '0.1.0';

    return next.handle().pipe(
      map((payload) => {
        // Pass through if the controller already returned an envelope.
        if (
          payload !== null &&
          typeof payload === 'object' &&
          // biome-ignore lint/suspicious/noExplicitAny: runtime check
          'data' in (payload as any) &&
          // biome-ignore lint/suspicious/noExplicitAny: runtime check
          'meta' in (payload as any)
        ) {
          return payload;
        }
        return {
          data: payload,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
            version,
          },
        };
      }),
    );
  }
}
