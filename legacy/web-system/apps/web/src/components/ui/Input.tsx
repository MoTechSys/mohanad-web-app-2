import { type InputHTMLAttributes, type ReactNode, forwardRef, useId } from 'react';

import { cn } from '@/lib/cn';

/**
 * Input — text/email/password field with label, optional left/right icons,
 * helper / error text, and a generated id when none is provided.
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Show the field as required (label gets a red asterisk). */
  required?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, id, label, helperText, errorText, leftIcon, rightIcon, required, ...rest },
    ref,
  ) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const describedById = `${fieldId}-desc`;

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-ink">
            {label}
            {required ? <span className="text-danger ms-1">*</span> : null}
          </label>
        ) : null}

        <div className="relative">
          {leftIcon ? (
            <span
              className="absolute inset-y-0 start-3 flex items-center text-gray-400"
              aria-hidden
            >
              {leftIcon}
            </span>
          ) : null}

          <input
            id={fieldId}
            ref={ref}
            aria-invalid={Boolean(errorText) || undefined}
            aria-describedby={helperText || errorText ? describedById : undefined}
            className={cn(
              'input',
              leftIcon && 'ps-10',
              rightIcon && 'pe-10',
              errorText && 'border-danger focus:border-danger focus:shadow-none',
              className,
            )}
            {...rest}
          />

          {rightIcon ? (
            <span className="absolute inset-y-0 end-3 flex items-center text-gray-400" aria-hidden>
              {rightIcon}
            </span>
          ) : null}
        </div>

        {errorText ? (
          <p id={describedById} className="text-xs text-danger">
            {errorText}
          </p>
        ) : helperText ? (
          <p id={describedById} className="text-xs text-gray-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
