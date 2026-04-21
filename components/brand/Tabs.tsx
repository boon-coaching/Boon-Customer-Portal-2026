import React, { HTMLAttributes, ReactNode, useId } from 'react';

/**
 * Tabs
 *
 * Pill-in-pill tab bar with a selected white tab floating over a gray track.
 * Controlled API: consumer owns the active value and the onChange handler.
 *
 * Source: Boon Design System.
 *
 * Example:
 *   const [tab, setTab] = useState('competencies');
 *   <Tabs
 *     value={tab}
 *     onValueChange={setTab}
 *     items={[
 *       { value: 'competencies', label: 'Competencies' },
 *       { value: 'wellbeing', label: 'Wellbeing' },
 *     ]}
 *   />
 */

interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
}

const sizeClasses: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Tabs({
  items,
  value,
  onValueChange,
  size = 'md',
  className = '',
  ...rest
}: Props) {
  const listId = useId();
  return (
    <div
      {...rest}
      role="tablist"
      aria-orientation="horizontal"
      className={`inline-flex gap-2 p-1 rounded-[999px] ${className}`}
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--boon-charcoal) 6%, transparent)',
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            id={`${listId}-${item.value}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={item.disabled || undefined}
            disabled={item.disabled}
            onClick={() => !item.disabled && onValueChange(item.value)}
            className={[
              'rounded-[999px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
              sizeClasses[size],
              active
                ? 'bg-white text-[var(--boon-navy)] shadow-sm'
                : 'text-[var(--boon-charcoal)]/60 hover:text-[var(--boon-navy)]',
            ].join(' ')}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
