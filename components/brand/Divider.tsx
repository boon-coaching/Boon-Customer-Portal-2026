import React, { HTMLAttributes } from 'react';

/**
 * Divider
 *
 * Horizontal or vertical separator. Supports solid and dotted variants.
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Divider />
 *   <Divider variant="dotted" color="coral" />
 *   <Divider orientation="vertical" className="h-12" />
 */

type Orientation = 'horizontal' | 'vertical';
type Variant = 'solid' | 'dotted';
type Color = 'charcoal' | 'coral' | 'blue' | 'navy' | 'white';

interface Props extends HTMLAttributes<HTMLDivElement> {
  orientation?: Orientation;
  variant?: Variant;
  color?: Color;
}

const colorVar: Record<Color, string> = {
  charcoal: 'var(--boon-charcoal)',
  coral: 'var(--boon-coral)',
  blue: 'var(--boon-blue)',
  navy: 'var(--boon-navy)',
  white: 'var(--boon-white)',
};

export function Divider({
  orientation = 'horizontal',
  variant = 'solid',
  color = 'charcoal',
  className = '',
  style,
  ...rest
}: Props) {
  const isHorizontal = orientation === 'horizontal';
  const borderStyle = variant === 'dotted' ? 'dotted' : 'solid';
  const opacity = variant === 'dotted' ? 0.5 : 0.1;

  const base: React.CSSProperties = isHorizontal
    ? {
        width: '100%',
        height: 0,
        borderTopWidth: variant === 'dotted' ? '2px' : '1px',
        borderTopStyle: borderStyle,
        borderTopColor: colorVar[color],
        opacity,
      }
    : {
        display: 'inline-block',
        width: 0,
        alignSelf: 'stretch',
        borderLeftWidth: variant === 'dotted' ? '2px' : '1px',
        borderLeftStyle: borderStyle,
        borderLeftColor: colorVar[color],
        opacity,
      };

  return (
    <div
      {...rest}
      role="separator"
      aria-orientation={orientation}
      className={className}
      style={{ ...base, ...style }}
    />
  );
}
