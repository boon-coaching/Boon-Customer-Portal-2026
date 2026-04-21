import React, { HTMLAttributes, ReactNode } from 'react';

/**
 * Badge
 *
 * Compact status or category label.
 *
 * Variants:
 *   Status:  success | warning | error | info | neutral
 *   Product: scale | grow | exec | together | adapt
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Badge variant="success">Completed</Badge>
 *   <Badge variant="scale">SCALE</Badge>
 */

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
type ProductVariant = 'scale' | 'grow' | 'exec' | 'together' | 'adapt';
type Variant = StatusVariant | ProductVariant;

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  success:
    'bg-[var(--boon-green)]/15 text-[#2F7D4F] border-[var(--boon-green)]/30',
  warning:
    'bg-[var(--boon-warning-light)] text-[var(--boon-warning-dark)] border-[var(--boon-warning)]/30',
  error:
    'bg-[var(--boon-coral)]/15 text-[var(--boon-coral-legacy-dark)] border-[var(--boon-coral)]/30',
  info:
    'bg-[var(--boon-blue-light)] text-[var(--boon-blue-dark)] border-[var(--boon-blue)]/30',
  neutral:
    'bg-[var(--boon-charcoal)]/8 text-[var(--boon-charcoal)] border-[var(--boon-charcoal)]/15',
  scale:
    'bg-[var(--boon-product-scale-accent)]/40 text-[var(--boon-product-scale)] border-[var(--boon-product-scale)]/30',
  grow:
    'bg-[var(--boon-product-grow-accent)]/40 text-[var(--boon-product-grow)] border-[var(--boon-product-grow)]/40',
  exec:
    'bg-[var(--boon-product-exec)]/8 text-[var(--boon-product-exec)] border-[var(--boon-product-exec)]/20',
  together:
    'bg-[var(--boon-product-together-accent)]/50 text-[var(--boon-product-together)] border-[var(--boon-product-together)]/40',
  adapt:
    'bg-[var(--boon-product-adapt-accent)]/40 text-[var(--boon-product-adapt)] border-[var(--boon-product-adapt)]/30',
};

export function Badge({
  variant = 'neutral',
  className = '',
  children,
  ...rest
}: Props) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[999px] border text-[11px] font-semibold uppercase tracking-[0.08em] ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
