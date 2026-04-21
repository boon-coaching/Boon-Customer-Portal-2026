import React, { ReactNode } from 'react';

/**
 * Eyebrow
 *
 * Category label that sits above a Headline. ALL CAPS, wide tracking,
 * Inter ExtraBold, rendered with a short leading rule in Boon blue.
 *
 * Example:
 *   <Eyebrow>Grow, Leadership program overview</Eyebrow>
 *   <Eyebrow rule={false}>Viewing cohort</Eyebrow>
 */

interface EyebrowProps {
  children: ReactNode;
  /** Show the short colored rule to the left of the label. Default true. */
  rule?: boolean;
  /** Optional className passthrough. */
  className?: string;
}

export function Eyebrow({ children, rule = true, className = '' }: EyebrowProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 mb-3 ${className}`}>
      {rule && (
        <span
          aria-hidden
          className="inline-block w-5 h-px"
          style={{ backgroundColor: 'var(--boon-blue)' }}
        />
      )}
      <span
        className="font-body font-extrabold uppercase"
        style={{
          fontSize: '10.5px',
          letterSpacing: '0.18em',
          color: '#6B7280',
        }}
      >
        {children}
      </span>
    </div>
  );
}
