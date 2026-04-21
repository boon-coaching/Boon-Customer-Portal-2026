import React, { InputHTMLAttributes, forwardRef, useId, ReactNode } from 'react';

/**
 * Radio
 *
 * Single radio option. Use inside a named group (share the same `name` prop).
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Radio name="frequency" value="daily" label="Daily" checked={v === 'daily'} />
 */

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
  description?: string;
}

export const Radio = forwardRef<HTMLInputElement, Props>(function Radio(
  { label, description, id, className = '', ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  return (
    <label
      htmlFor={inputId}
      className={`flex items-start gap-3 cursor-pointer ${className}`}
    >
      <input
        {...rest}
        id={inputId}
        ref={ref}
        type="radio"
        className="mt-0.5 w-4 h-4 border-[var(--boon-charcoal)]/30 text-[var(--boon-blue)] accent-[var(--boon-blue)] focus:ring-2 focus:ring-[var(--boon-blue)]/30"
      />
      <span className="flex-1">
        <span className="block text-sm text-[var(--boon-charcoal)]">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--boon-charcoal)]/60 mt-0.5">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
});
