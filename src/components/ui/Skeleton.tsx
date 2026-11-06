import React, { useRef } from 'react';

export interface SkeletonProps {
  shape?: 'row' | 'card' | 'week' | 'text';
  count?: number;
  className?: string;
}

/**
 * Geometry-matched placeholders that prevent jarring layout shifts.
 * Renders pulse-animated skeletons matching list rows, weekly schedule grids, or content cards.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  shape = 'row',
  count = 3,
  className = '',
}) => {
  if (shape === 'week') {
    return (
      <div
        className={`grid grid-cols-5 gap-2 w-full animate-pulse select-none ${className}`}
        role="status"
        aria-label="Loading schedule..."
      >
        {Array.from({ length: 5 }, (_, col) => (
          <div key={col} className="space-y-2">
            <div className="h-6 bg-surface-3/80 rounded-[var(--radius-control)] w-full mb-1" />
            {Array.from({ length: count }, (_, row) => (
              <div
                key={row}
                className="h-16 bg-surface-2/70 border border-subtle/50 rounded-[var(--radius-card)] p-2 space-y-1.5"
              >
                <div className="h-3 bg-surface-3 rounded w-3/4" />
                <div className="h-2.5 bg-surface-3/60 rounded w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (shape === 'card') {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 w-full animate-pulse select-none ${className}`}
        role="status"
        aria-label="Loading cards..."
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-[var(--radius-card)] bg-surface-2/60 border border-subtle space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-surface-3 rounded w-24" />
              <div className="h-4 bg-surface-3 rounded-full w-12" />
            </div>
            <div className="h-3.5 bg-surface-3/80 rounded w-full" />
            <div className="h-3 bg-surface-3/50 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (shape === 'text') {
    return (
      <div
        className={`space-y-2 w-full animate-pulse select-none ${className}`}
        role="status"
        aria-label="Loading content..."
      >
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`h-3 bg-surface-3/70 rounded ${i === count - 1 ? 'w-2/3' : 'w-full'}`}
          />
        ))}
      </div>
    );
  }

  // shape === 'row' (default)
  return (
    <div
      className={`space-y-2 w-full animate-pulse select-none ${className}`}
      role="status"
      aria-label="Loading list items..."
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="h-10 rounded-[var(--radius-control)] bg-surface-2/70 border border-subtle/60 flex items-center px-3 justify-between"
        >
          <div className="flex items-center space-x-2.5 w-2/3">
            <div className="w-4 h-4 rounded-full bg-surface-3 shrink-0" />
            <div className="h-3 bg-surface-3 rounded w-full" />
          </div>
          <div className="h-4 bg-surface-3 rounded-full w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
};

/**
 * Returns a smooth fade-in reveal class when loading transitions from true to false.
 * Prevents flashing on instant cache hits.
 */
export function useReveal(loading: boolean): string {
  const hadLoading = useRef(false);
  if (loading) {
    hadLoading.current = true;
  }
  return !loading && hadLoading.current ? 'transition-opacity duration-200 animate-fadeIn' : '';
}
