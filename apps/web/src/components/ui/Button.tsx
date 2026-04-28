import { Loader2 } from 'lucide-react';
import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';

import { cn } from '@/lib/cn';

/**
 * Button — primary action surface.
 *
 * Variants: primary (filled), secondary (outline), ghost, danger.
 * Sizes:    sm, md, lg. Loading state replaces leading icon with a spinner.
 */
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      type = 'button',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      fullWidth,
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={cn(variantClasses[variant], sizeClasses[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : leftIcon ? (
        <span className="-ms-1 inline-flex items-center" aria-hidden>
          {leftIcon}
        </span>
      ) : null}
      <span>{children}</span>
      {rightIcon && !isLoading ? (
        <span className="-me-1 inline-flex items-center" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  ),
);

Button.displayName = 'Button';
