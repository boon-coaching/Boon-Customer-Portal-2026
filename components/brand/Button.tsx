import React, {
  ButtonHTMLAttributes,
  AnchorHTMLAttributes,
  ReactNode,
  forwardRef,
} from 'react';

/**
 * Button
 *
 * Boon's standard interactive pill. Primary CTAs, nav buttons, and inline
 * action links.
 *
 * Variants
 *   primary   Boon Blue fill, the default CTA across product and marketing.
 *   navy      Navy fill, authority CTA for focus surfaces.
 *   coral     Coral fill, marketing CTAs.
 *   secondary White fill with coral outline, pairs with coral primaries.
 *   ghost     Transparent, inline link-style action.
 *
 * Radius is intentionally a full pill (999px) per the Boon Design System
 * canon, shared with marketing and the employee portal. Do not override
 * to 8px locally; keep button shape consistent across Boon surfaces.
 *
 * Source: Boon Design System (asimmons-coder/boon-design-system).
 *
 * Example:
 *   <Button>Book a Strategy Call</Button>
 *   <Button variant="navy">Start your reflection</Button>
 *   <Button as="a" href="/pricing" variant="ghost">See pricing</Button>
 */

type Variant = 'primary' | 'navy' | 'coral' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--boon-blue)] text-white hover:bg-[var(--boon-blue-dark)] active:bg-[var(--boon-navy)]',
  navy:
    'bg-[var(--boon-navy)] text-white hover:bg-[var(--boon-blue)] active:bg-[var(--boon-blue-dark)]',
  coral:
    'bg-[var(--boon-coral)] text-white hover:bg-[var(--boon-coral-light)] active:bg-[var(--boon-coral)]',
  secondary:
    'bg-white text-[var(--boon-coral)] border-[1.5px] border-[var(--boon-coral)] hover:bg-[var(--boon-coral)] hover:text-white',
  ghost:
    'bg-transparent text-[var(--boon-charcoal)]/70 hover:text-[var(--boon-navy)]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'px-4 py-2 text-[12px]',
  md: 'px-5 py-3 text-[13px]',
  lg: 'px-6 py-4 text-sm',
};

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' };
type AnchorProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a' };
type Props = ButtonProps | AnchorProps;

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, Props>(
  function Button(
    { variant = 'primary', size = 'md', icon, loading = false, className = '', children, ...rest },
    ref,
  ) {
    const disabled = loading || ('disabled' in rest && rest.disabled);
    const classes = [
      'inline-flex items-center justify-center gap-[10px] rounded-[999px]',
      'font-[var(--font-display)] font-medium tracking-[0.01em] transition-colors',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ');

    const content = (
      <>
        {loading ? <Spinner /> : null}
        {children}
        {!loading && icon ? icon : null}
      </>
    );

    if ('as' in rest && rest.as === 'a') {
      const { as: _as, ...anchorRest } = rest as AnchorProps;
      return (
        <a
          {...(anchorRest as AnchorHTMLAttributes<HTMLAnchorElement>)}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-disabled={disabled || undefined}
        >
          {content}
        </a>
      );
    }

    const { as: _as, ...buttonRest } = rest as ButtonProps;
    return (
      <button
        {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        disabled={disabled}
      >
        {content}
      </button>
    );
  },
);

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
