import { describe, expect, it } from 'vitest';
import { changePasswordSchema, loginSchema } from '../auth';

describe('loginSchema', () => {
  it('accepts a valid username + password', () => {
    const result = loginSchema.safeParse({
      username: 'owner',
      password: 'Owner@12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe('owner');
      expect(result.data.rememberMe).toBe(false); // default applied
    }
  });

  it('respects an explicit rememberMe flag', () => {
    const result = loginSchema.safeParse({
      username: 'owner',
      password: 'Owner@12345',
      rememberMe: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rememberMe).toBe(true);
    }
  });

  it('rejects too-short usernames', () => {
    const result = loginSchema.safeParse({
      username: 'ab',
      password: 'Owner@12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects passwords shorter than 8 chars', () => {
    const result = loginSchema.safeParse({
      username: 'owner',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects usernames with invalid characters', () => {
    const result = loginSchema.safeParse({
      username: 'owner!',
      password: 'Owner@12345',
    });
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts when the new password and confirmation match', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'NewPass@123',
      confirmPassword: 'NewPass@123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when new and confirm passwords differ', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'NewPass@123',
      confirmPassword: 'Different@1',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword']);
    }
  });

  it('rejects when current password is empty', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewPass@123',
      confirmPassword: 'NewPass@123',
    });
    expect(result.success).toBe(false);
  });
});
