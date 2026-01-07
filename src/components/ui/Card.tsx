/**
 * Card Component
 *
 * Content container with interactive, selected, and data variants.
 * Supports both div and button rendering for accessibility.
 */

import { forwardRef } from 'react';

export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual variant */
  variant?: 'default' | 'interactive' | 'selected' | 'data';
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Render as button for clickable cards */
  as?: 'div' | 'button';
  /** Selected state (for interactive variant) */
  isSelected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const variantClasses = {
  default: 'bg-white/40 border border-stone-200/40',
  interactive:
    'bg-white/60 border border-transparent hover:bg-white hover:border-stone-200/60 hover:shadow-sm cursor-pointer transition-all duration-200 ease-smooth-out',
  selected: 'bg-primary-50 border border-primary-200 shadow-sm',
  data: 'bg-white/60 border border-stone-200/40 hover:bg-white/80 hover:border-stone-300/60 cursor-pointer transition-colors duration-200',
} as const;

const paddingClasses = {
  none: '',
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
} as const;

/**
 * Card is a flexible container for grouped content.
 *
 * @example
 * // Static content card
 * <Card padding="md">Content here</Card>
 *
 * @example
 * // Interactive card with selection state
 * <Card
 *   variant={isSelected ? 'selected' : 'interactive'}
 *   as="button"
 *   onClick={() => setSelected(id)}
 * >
 *   Clickable card
 * </Card>
 *
 * @example
 * // Data card for ratings/stats
 * <Card variant="data" padding="md" as="button" onClick={openModal}>
 *   Rating: 4.5
 * </Card>
 */
export const Card = forwardRef<HTMLDivElement | HTMLButtonElement, CardProps>(
  function Card(
    {
      children,
      variant = 'default',
      padding = 'md',
      as = 'div',
      isSelected = false,
      onClick,
      className = '',
    },
    ref
  ) {
    // Determine actual variant based on isSelected
    const effectiveVariant = isSelected ? 'selected' : variant;

    const classes = `
      ${variantClasses[effectiveVariant]}
      ${paddingClasses[padding]}
      rounded-lg
      ${className}
    `;

    if (as === 'button') {
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          type="button"
          onClick={onClick}
          className={`w-full text-left ${classes}`}
        >
          {children}
        </button>
      );
    }

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        onClick={onClick}
        className={classes}
      >
        {children}
      </div>
    );
  }
);

export default Card;
