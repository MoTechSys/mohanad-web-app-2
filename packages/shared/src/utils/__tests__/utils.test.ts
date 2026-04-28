import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  maskPhone,
  parseDecimal,
} from '../index';

describe('formatMoney', () => {
  it('formats a positive number with two decimals and currency suffix', () => {
    expect(formatMoney(1234.5, 'YER')).toBe('1,234.50 YER');
  });

  it('uses YER as default currency', () => {
    expect(formatMoney(100)).toBe('100.00 YER');
  });

  it('accepts a string input', () => {
    expect(formatMoney('2500.75', 'USD')).toBe('2,500.75 USD');
  });

  it('handles zero', () => {
    expect(formatMoney(0, 'YER')).toBe('0.00 YER');
  });

  it('handles non-finite values gracefully', () => {
    expect(formatMoney(Number.NaN, 'YER')).toBe('0.00 YER');
    expect(formatMoney('not-a-number', 'YER')).toBe('0.00 YER');
  });

  it('rounds to two decimals', () => {
    expect(formatMoney(1.005, 'YER')).toBe('1.01 YER');
    expect(formatMoney(1.004, 'YER')).toBe('1.00 YER');
  });
});

describe('parseDecimal', () => {
  it('returns 0 for null/undefined', () => {
    expect(parseDecimal(null)).toBe(0);
    expect(parseDecimal(undefined)).toBe(0);
  });

  it('parses a numeric string', () => {
    expect(parseDecimal('123.45')).toBe(123.45);
  });

  it('returns numbers as-is when finite', () => {
    expect(parseDecimal(42)).toBe(42);
  });

  it('returns 0 for invalid strings', () => {
    expect(parseDecimal('abc')).toBe(0);
  });
});

describe('hasPermission', () => {
  const userPerms = ['users.view', 'users.create', 'sales.view'];

  it('returns true when the user owns the required permission', () => {
    expect(hasPermission(userPerms, 'users.view')).toBe(true);
  });

  it('returns false when the user lacks the permission', () => {
    expect(hasPermission(userPerms, 'users.delete')).toBe(false);
  });

  it('returns false on empty user permission list', () => {
    expect(hasPermission([], 'users.view')).toBe(false);
  });
});

describe('hasAllPermissions', () => {
  const userPerms = ['a', 'b', 'c'];

  it('returns true when every required permission is present', () => {
    expect(hasAllPermissions(userPerms, ['a', 'b'])).toBe(true);
  });

  it('returns false when any required permission is missing', () => {
    expect(hasAllPermissions(userPerms, ['a', 'd'])).toBe(false);
  });

  it('returns true for empty required list (vacuous truth)', () => {
    expect(hasAllPermissions(userPerms, [])).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  const userPerms = ['a', 'b'];

  it('returns true when at least one permission matches', () => {
    expect(hasAnyPermission(userPerms, ['a', 'x'])).toBe(true);
  });

  it('returns false when none match', () => {
    expect(hasAnyPermission(userPerms, ['x', 'y'])).toBe(false);
  });

  it('returns false for empty required list', () => {
    expect(hasAnyPermission(userPerms, [])).toBe(false);
  });
});

describe('maskPhone', () => {
  it('keeps the first three and last three digits and masks the middle', () => {
    expect(maskPhone('967711234567')).toBe('967******567');
  });

  it('returns the input unchanged when shorter than 7 chars', () => {
    expect(maskPhone('12345')).toBe('12345');
  });

  it('handles empty input', () => {
    expect(maskPhone('')).toBe('');
  });
});
