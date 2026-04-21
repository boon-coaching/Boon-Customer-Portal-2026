import React, {
  TextareaHTMLAttributes,
  forwardRef,
  useId,
  useEffect,
  useRef,
} from 'react';

/**
 * Textarea
 *
 * Multiline text input. Matches Input for label, error, help slots.
 *
 * Props:
 *   autoResize  grows with content
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Textarea label="Notes" autoResize />
 */

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  {
    label,
    error,
    help,
    id,
    className = '',
    autoResize = false,
    rows = 4,
    onChange,
    ...rest
  },
  forwardedRef,
) {
  const reactId = useId();
  const textareaId = id ?? reactId;
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const hasError = Boolean(error);

  useEffect(() => {
    if (!autoResize || !localRef.current) return;
    const el = localRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize, rest.value]);

  const setRef = (el: HTMLTextAreaElement | null) => {
    localRef.current = el;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef)
      (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={textareaId}
          className="block text-xs font-bold text-[var(--boon-charcoal)]/60 uppercase tracking-widest mb-2"
        >
          {label}
        </label>
      ) : null}
      <textarea
        {...rest}
        id={textareaId}
        ref={setRef}
        rows={rows}
        onChange={onChange}
        aria-invalid={hasError || undefined}
        aria-describedby={
          hasError ? `${textareaId}-error` : help ? `${textareaId}-help` : undefined
        }
        className={[
          'w-full px-4 py-3 rounded-[10px] outline-none transition-all',
          'bg-[var(--boon-off-white)] border-2 resize-none',
          hasError
            ? 'border-[var(--boon-coral)] focus:border-[var(--boon-coral)]'
            : 'border-transparent focus:bg-white focus:border-[var(--boon-blue)]',
          'text-[var(--boon-charcoal)] font-medium placeholder:text-[var(--boon-charcoal)]/40',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      />
      {hasError ? (
        <p id={`${textareaId}-error`} className="mt-2 text-sm text-[var(--boon-coral)]">
          {error}
        </p>
      ) : help ? (
        <p
          id={`${textareaId}-help`}
          className="mt-2 text-xs text-[var(--boon-charcoal)]/60"
        >
          {help}
        </p>
      ) : null}
    </div>
  );
});
