/**
 * ZodValidationPipe — Jest spec.
 *
 * Regression guard for the sales/daily-income 500 bug: a list endpoint must
 * pass `'query'` as the pipe target so query params (which arrive as strings)
 * are coerced via `z.coerce.number()` before hitting Prisma. A pipe targeting
 * `'body'` must NOT transform query params (returns them untouched).
 */
import type { ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';

import { ZodValidationPipe } from '../zod-validation.pipe';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const meta = (type: ArgumentMetadata['type']): ArgumentMetadata =>
  ({ type, metatype: undefined, data: undefined }) as ArgumentMetadata;

describe('ZodValidationPipe', () => {
  it("coerces string query params to numbers when target is 'query'", () => {
    const pipe = new ZodValidationPipe(querySchema, 'query');
    const out = pipe.transform({ page: '2', limit: '20' }, meta('query')) as {
      page: number;
      limit: number;
    };
    expect(out.page).toBe(2);
    expect(out.limit).toBe(20);
    expect(typeof out.limit).toBe('number');
  });

  it("does NOT touch query params when target is 'body' (default)", () => {
    const pipe = new ZodValidationPipe(querySchema);
    const input = { page: '2', limit: '20' };
    expect(pipe.transform(input, meta('query'))).toBe(input);
  });

  it('applies schema defaults for missing query params', () => {
    const pipe = new ZodValidationPipe(querySchema, 'query');
    const out = pipe.transform({}, meta('query')) as { page: number; limit: number };
    expect(out.page).toBe(1);
    expect(out.limit).toBe(20);
  });
});
