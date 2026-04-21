import React, { HTMLAttributes, useMemo } from 'react';

/**
 * Avatar
 *
 * Circular user avatar with image fallback to initials.
 *
 * Sizes: sm (24) | md (32) | lg (40) | xl (64)
 *
 * Source: Boon Design System.
 *
 * Example:
 *   <Avatar name="Alex Simmons" src="/alex.jpg" size="lg" />
 *   <Avatar name="Olivia Chen" size="md" />
 */

type Size = 'sm' | 'md' | 'lg' | 'xl';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: Size;
  alt?: string;
}

const sizeClasses: Record<Size, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-16 h-16 text-xl',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = 'md',
  alt,
  className = '',
  ...rest
}: Props) {
  const initials = useMemo(() => getInitials(name), [name]);
  const classes = [
    'inline-flex items-center justify-center rounded-[999px] flex-shrink-0 overflow-hidden',
    'bg-[var(--boon-blue)] text-white font-bold',
    sizeClasses[size],
    className,
  ].join(' ');

  return (
    <span {...rest} className={classes} aria-label={alt ?? name} role="img">
      {src ? (
        <img src={src} alt={alt ?? name} className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
