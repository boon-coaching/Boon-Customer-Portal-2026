import React, { HTMLAttributes, ReactNode } from 'react';

/**
 * Card
 *
 * Boon's container surface. Three variants, each with a distinct purpose.
 *
 *   default          Inline dashboard tile, off-white on white, subtle
 *                    border and shadow. Use for the bulk of metric cards,
 *                    data panels, and list surfaces.
 *   navy             Authority surface with optional radial glow and
 *                    dotted texture. Use for the one or two hero moments
 *                    per page that should feel heavier than the rest.
 *   coral-outlined   CTA surface with an optional soft coral accent blob.
 *                    Use sparingly for the single most important action
 *                    on a screen.
 *
 * Source: Boon Design System (asimmons-coder/boon-design-system).
 *
 * Example:
 *   <Card>Dashboard tile</Card>
 *   <Card variant="navy" glow="coral" dots padding="lg">Focus card</Card>
 *   <Card variant="coral-outlined" accent>Book a Strategy Call</Card>
 */

type Variant = 'default' | 'navy' | 'coral-outlined';
type Padding = 'sm' | 'md' | 'lg';
type Glow = 'coral' | 'blue' | 'none';

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  glow?: Glow;
  dots?: boolean;
  accent?: boolean;
  children: ReactNode;
}

const paddingClasses: Record<Padding, string> = {
  sm: 'p-5',
  md: 'p-7',
  lg: 'p-10',
};

export function Card({
  variant = 'default',
  padding = 'md',
  glow = 'blue',
  dots = false,
  accent = false,
  className = '',
  children,
  ...rest
}: Props) {
  if (variant === 'navy') {
    return (
      <div
        {...rest}
        className={`relative overflow-hidden rounded-[10px] text-white ${paddingClasses[padding]} ${className}`}
        style={{ backgroundColor: 'var(--boon-navy)' }}
      >
        {glow === 'coral' ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 109, 106, 0.22) 0%, transparent 65%)',
            }}
          />
        ) : glow === 'blue' ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full"
            style={{
              background:
                'radial-gradient(circle, rgba(70, 111, 246, 0.32) 0%, transparent 65%)',
            }}
          />
        ) : null}
        {dots ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-4 right-4 h-10 w-10"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255, 255, 255, 0.22) 1px, transparent 1.2px)',
              backgroundSize: '6px 6px',
            }}
          />
        ) : null}
        <div className="relative">{children}</div>
      </div>
    );
  }

  if (variant === 'coral-outlined') {
    return (
      <div
        {...rest}
        className={`relative overflow-hidden rounded-[10px] bg-white ${paddingClasses[padding]} ${className}`}
        style={{ border: '1.5px solid var(--boon-coral)' }}
      >
        {accent ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(circle, var(--boon-coral-soft) 0%, transparent 65%)',
            }}
          />
        ) : null}
        <div className="relative">{children}</div>
      </div>
    );
  }

  return (
    <div
      {...rest}
      className={`rounded-[10px] bg-white ${paddingClasses[padding]} ${className}`}
      style={{
        border: '1px solid color-mix(in srgb, var(--boon-charcoal) 10%, transparent)',
        boxShadow: '0 1px 2px rgba(26, 37, 59, 0.04)',
      }}
    >
      {children}
    </div>
  );
}
