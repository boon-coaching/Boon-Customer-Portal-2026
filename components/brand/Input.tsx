import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

/**
 * Input
 *
 * Text input with optional label, error, and help slots. Source:
 * Boon Design System (asimmons-coder/boon-design-system).
 *
 * Example:
 *   <Input label="Work Email" type="email" error={err} />
 */

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, help, id, className = '', ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-[var(--boon-charcoal)]/60 uppercase tracking-widest mb-2"
        >
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={inputId}
        ref={ref}
        aria-invalid={hasError || undefined}
        aria-describedby={
          hasError ? `${inputId}-error` : help ? `${inputId}-help` : undefined
        }
        className={[
          'w-full px-4 py-3 rounded-[10px] outline-none transition-all',
          'bg-[var(--boon-off-white)] border-2',
          hasError
            ? 'border-[var(--boon-coral)] focus:border-[var(--boon-coral)]'
            : 'border-transparent focus:bg-white focus:border-[var(--boon-blue)]',
          'text-[var(--boon-charcoal)] font-medium placeholder:text-[var(--boon-charcoal)]/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      />
      {hasError ? (
        <p id={`${inputId}-error`} className="mt-2 text-sm text-[var(--boon-coral)]">
          {error}
        </p>
      ) : help ? (
        <p
          id={`${inputId}-help`}
          className="mt-2 text-xs text-[var(--boon-charcoal)]/60"
        >
          {help}
        </p>
      ) : null}
    </div>
  );
});
