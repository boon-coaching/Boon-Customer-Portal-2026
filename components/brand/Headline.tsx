import React, { ReactNode, HTMLAttributes } from 'react';

/**
 * Headline
 *
 * Renders the signature Boon pattern: DM Sans Bold statement with an
 * optional DM Serif Text italic kicker.
 *
 * Imported from the canonical Boon Design System
 * (asimmons-coder/boon-design-system) to keep every Boon surface on the
 * same headline system.
 *
 * Example:
 *   <Headline statement="Growth that" kicker="compounds." />
 *   <Headline as="h2" size="md" statement="Your team's coaching," kicker="measured." />
 */

type Size = 'xl' | 'lg' | 'md' | 'sm';
type KickerColor = 'blue' | 'coral' | 'coral-light' | 'navy';

interface HeadlineProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3';
  size?: Size;
  statement?: ReactNode;
  kicker?: ReactNode;
  kickerColor?: KickerColor;
  children?: ReactNode;
}

const sizeClasses: Record<Size, string> = {
  xl: 'text-[40px] md:text-[56px] leading-[1] tracking-[-0.025em]',
  lg: 'text-[32px] md:text-[40px] leading-[1.08] tracking-[-0.02em]',
  md: 'text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em]',
  sm: 'text-[18px] md:text-[20px] leading-[1.2] tracking-[-0.015em]',
};

const kickerColors: Record<KickerColor, string> = {
  blue: 'text-[var(--boon-blue)]',
  coral: 'text-[var(--boon-coral)]',
  'coral-light': 'text-[var(--boon-coral-light)]',
  navy: 'text-[var(--boon-navy)]',
};

export function Headline({
  as = 'h1',
  size = 'lg',
  statement,
  kicker,
  kickerColor = 'blue',
  className = '',
  children,
  ...rest
}: HeadlineProps) {
  const Tag = as;
  return (
    <Tag
      {...rest}
      className={`font-[var(--font-display)] font-extrabold text-[var(--boon-navy)] ${sizeClasses[size]} ${className}`}
    >
      {statement !== undefined ? (
        <>
          {statement}
          {kicker ? (
            <>
              {' '}
              <Kicker color={kickerColor}>{kicker}</Kicker>
            </>
          ) : null}
        </>
      ) : (
        children
      )}
    </Tag>
  );
}

interface KickerProps extends HTMLAttributes<HTMLSpanElement> {
  color?: KickerColor;
  block?: boolean;
  children: ReactNode;
}

function Kicker({ color = 'blue', block = false, className = '', children, ...rest }: KickerProps) {
  return (
    <span
      {...rest}
      className={`font-[var(--font-serif)] italic font-normal ${kickerColors[color]} ${block ? 'block mt-1' : ''} ${className}`}
    >
      {children}
    </span>
  );
}

Headline.Kicker = Kicker;
