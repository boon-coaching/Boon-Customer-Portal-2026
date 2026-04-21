import React, { SelectHTMLAttributes, forwardRef, useId, ReactNode } from 'react';

/**
 * Select
 *
 * Native select element with Boon styling. Keeps native behavior for
 * accessibility and mobile.
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Select label="Cohort">
 *     <option value="all">All Cohorts</option>
 *   </Select>
 */

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, error, help, id, className = '', children, ...rest },
  ref,
) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-[var(--boon-charcoal)]/60 uppercase tracking-widest mb-2"
        >
          {label}
        </label>
      ) : null}
      <select
        {...rest}
        id={selectId}
        ref={ref}
        aria-invalid={hasError || undefined}
        aria-describedby={
          hasError ? `${selectId}-error` : help ? `${selectId}-help` : undefined
        }
        className={[
          'w-full px-4 py-3 rounded-[10px] outline-none transition-all appearance-none',
          'bg-[var(--boon-off-white)] bg-no-repeat bg-[right_1rem_center] bg-[length:1rem]',
          "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'><path d='M1 1l5 5 5-5' stroke='%232E353D' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>\")]",
          'border-2 pr-10',
          hasError
            ? 'border-[var(--boon-coral)] focus:border-[var(--boon-coral)]'
            : 'border-transparent focus:bg-white focus:border-[var(--boon-blue)]',
          'text-[var(--boon-charcoal)] font-medium',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      >
        {children}
      </select>
      {hasError ? (
        <p id={`${selectId}-error`} className="mt-2 text-sm text-[var(--boon-coral)]">
          {error}
        </p>
      ) : help ? (
        <p
          id={`${selectId}-help`}
          className="mt-2 text-xs text-[var(--boon-charcoal)]/60"
        >
          {help}
        </p>
      ) : null}
    </div>
  );
});
