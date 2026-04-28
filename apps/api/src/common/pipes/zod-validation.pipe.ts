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
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    return this.schema.parse(value);
  }
}
