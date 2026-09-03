import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PasswordStrengthMeter, scorePassword } from '../PasswordStrengthMeter';

describe('scorePassword', () => {
  it('returns level 0 with neutral hint for empty input', () => {
    const r = scorePassword('');
    expect(r.level).toBe(0);
    expect(r.checks.length).toBe(false);
  });

  it('caps at level 2 when password is shorter than minLength', () => {
    const r = scorePassword('Aa1!', 8); // upper+lower+digit+special but length<8
    expect(r.checks.length).toBe(false);
    expect(r.level).toBe(2);
    expect(r.labelAr).toContain('أحرف');
  });

  it('marks a password "very weak" when only one rule passes', () => {
    // 7 chars (under min) + lower only → length=false → capped at 2 by penalty,
    // but only 1 rule satisfied (lower) → level 1.
    const r = scorePassword('aaaaaaa', 8);
    expect(r.level).toBe(1);
    expect(r.labelAr).toContain('ضعيفة');
  });

  it('marks a password "fair" with length + lower + digit', () => {
    const r = scorePassword('password1', 8); // length + lower + digit = 3
    expect(r.level).toBe(3);
  });

  it('marks a password "strong" with all five rules', () => {
    const r = scorePassword('Strong!Pass1', 8);
    expect(r.level).toBe(5);
    expect(r.labelAr).toContain('قوية');
    expect(r.checks).toMatchObject({
      length: true,
      upper: true,
      lower: true,
      digit: true,
      special: true,
    });
  });
});

describe('<PasswordStrengthMeter />', () => {
  it('shows the empty hint when no password is entered', () => {
    render(<PasswordStrengthMeter password="" />);
    expect(screen.getByText('أدخل كلمة المرور')).toBeInTheDocument();
  });

  it('renders the strong-password caption + length counter', () => {
    render(<PasswordStrengthMeter password="Strong!Pass1" minLength={8} />);
    expect(screen.getByText(/كلمة مرور قوية/)).toBeInTheDocument();
    expect(screen.getByText(/12\/8\+/)).toBeInTheDocument();
  });
});
