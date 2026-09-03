import { describe, expect, it } from 'vitest';
import {
  arabicNameSchema,
  cuidSchema,
  decimalSchema,
  paginationSchema,
  passwordSchema,
  phoneSchema,
  usernameSchema,
} from '../common';

describe('decimalSchema', () => {
  const schema = decimalSchema();

  it('accepts a positive number', () => {
    expect(schema.safeParse(100.5).success).toBe(true);
  });

  it('coerces a numeric string', () => {
    const result = schema.safeParse('123.45');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(123.45);
  });

  it('rejects zero by default', () => {
    expect(schema.safeParse(0).success).toBe(false);
  });

  it('allows zero when allowZero is true', () => {
    const z = decimalSchema({ allowZero: true });
    expect(z.safeParse(0).success).toBe(true);
  });

  it('rejects negative values', () => {
    expect(schema.safeParse(-1).success).toBe(false);
  });

  it('rejects more than 2 decimal places', () => {
    expect(schema.safeParse(1.234).success).toBe(false);
  });

  it('respects min/max bounds', () => {
    const z = decimalSchema({ min: 10, max: 100 });
    expect(z.safeParse(5).success).toBe(false);
    expect(z.safeParse(50).success).toBe(true);
    expect(z.safeParse(150).success).toBe(false);
  });
});

describe('cuidSchema', () => {
  it('accepts a valid cuid', () => {
    expect(cuidSchema.safeParse('clxabcdef0001234567890abc').success).toBe(true);
  });

  it('rejects a malformed id', () => {
    expect(cuidSchema.safeParse('not-a-cuid').success).toBe(false);
    expect(cuidSchema.safeParse('').success).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('applies sensible defaults when nothing is provided', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortDir).toBe('desc');
    }
  });

  it('coerces stringly-typed query parameters', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('rejects limits above PAGE_SIZE_MAX (100)', () => {
    expect(paginationSchema.safeParse({ limit: 500 }).success).toBe(false);
  });

  it('rejects unknown sortDir', () => {
    expect(paginationSchema.safeParse({ sortDir: 'sideways' }).success).toBe(false);
  });
});

describe('usernameSchema', () => {
  it('accepts alphanumerics and _ . -', () => {
    expect(usernameSchema.safeParse('owner_01').success).toBe(true);
    expect(usernameSchema.safeParse('admin.user').success).toBe(true);
    expect(usernameSchema.safeParse('first-last').success).toBe(true);
  });

  it('rejects spaces and other characters', () => {
    expect(usernameSchema.safeParse('owner 01').success).toBe(false);
    expect(usernameSchema.safeParse('owner!').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it('accepts an 8-char password', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('accepts a typical international number', () => {
    expect(phoneSchema.safeParse('+967711234567').success).toBe(true);
    expect(phoneSchema.safeParse('967711234567').success).toBe(true);
  });

  it('rejects non-digit input', () => {
    expect(phoneSchema.safeParse('phone-number').success).toBe(false);
  });

  it('is optional (undefined passes)', () => {
    expect(phoneSchema.safeParse(undefined).success).toBe(true);
  });
});

describe('arabicNameSchema', () => {
  it('accepts a non-empty Arabic name', () => {
    expect(arabicNameSchema.safeParse('بقالتي').success).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(arabicNameSchema.safeParse('').success).toBe(false);
  });

  it('rejects names longer than 120 chars', () => {
    expect(arabicNameSchema.safeParse('a'.repeat(121)).success).toBe(false);
  });
});
