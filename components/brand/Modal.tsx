import React, { HTMLAttributes, ReactNode, useEffect } from 'react';

/**
 * Modal
 *
 * Centered dialog with a blurred backdrop.
 *
 * Behavior:
 *   closes on backdrop click and Escape
 *   locks body scroll while open
 *
 * Slots:
 *   title     optional heading row (with close button)
 *   children  body content
 *   footer    optional action row
 *
 * Sizes: sm (max-w-sm), md (max-w-lg, default), lg (max-w-2xl).
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Modal open={open} onClose={close} title="Add employee">
 *     <p>Form fields here.</p>
 *   </Modal>
 */

type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  size?: Size;
  closeOnBackdrop?: boolean;
  children: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({
  open,
  onClose,
  title,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className = '',
  children,
  ...rest
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        {...rest}
        className={`bg-white rounded-[20px] p-7 w-full max-h-[90vh] overflow-y-auto ${sizeClasses[size]} ${className}`}
        style={{ boxShadow: 'var(--shadow-xl)' }}
      >
        {title !== undefined ? (
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-[var(--boon-navy)]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-[999px] flex items-center justify-center text-[var(--boon-charcoal)]/40 hover:text-[var(--boon-charcoal)] hover:bg-[var(--boon-off-white)] transition-all"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ) : null}
        <div>{children}</div>
        {footer ? (
          <div className="mt-6 flex items-center justify-end gap-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
