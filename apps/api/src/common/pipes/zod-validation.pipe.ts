import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Zod-based validation pipe (Foundation).
 *
 * Usage in a controller:
 *   @UsePipes(new ZodValidationPipe(loginSchema))
 *   @Post('login')
 *   login(@Body() body: LoginInput) { … }
 *
 * Throws a `ZodError` on failure — `AllExceptionsFilter` converts it
 * to HTTP 422 with the unified error envelope.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T | unknown> {
  constructor(
    private readonly schema: ZodSchema<T>,
    /**
     * Restrict which `@nestjs/common` parameter type triggers validation.
     * Default `'body'` — applied via `@UsePipes` to controller methods, this
     * prevents the pipe from attempting to parse `@Param`/`@Query` values
     * (which arrive as plain strings) against an object schema.
     *
     * Pass `'query'` to validate query objects, or `null` to validate any
     * value the pipe receives (legacy behaviour).
     */
    private readonly target: 'body' | 'query' | 'param' | null = 'body',
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): T | unknown {
    if (this.target !== null && metadata.type !== this.target) {
      return value;
    }
    return this.schema.parse(value);
  }
}
