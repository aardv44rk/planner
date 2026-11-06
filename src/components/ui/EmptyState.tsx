import React, { type ReactNode } from 'react';
import { type LucideIcon, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './controls';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
  role?: 'status' | 'alert';
}

/**
 * Standard empty state component providing a muted icon,
 * concise title, optional helper line, and single action button.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className = '',
  role = 'status',
}) => {
  return (
    <div
      role={role}
      className={`flex flex-col items-center justify-center text-center select-none ${
        compact ? 'p-3 space-y-1.5' : 'p-6 sm:p-8 space-y-3'
      } ${className}`}
    >
      <div
        className={`rounded-full flex items-center justify-center text-muted bg-surface-2 border border-subtle/70 ${
          compact ? 'w-8 h-8' : 'w-12 h-12'
        }`}
      >
        <Icon className={compact ? 'w-4 h-4 stroke-[1.75]' : 'w-6 h-6 stroke-[1.75]'} />
      </div>

      <div className="space-y-0.5 max-w-sm">
        {title && (
          <h4
            className={`font-semibold text-tx-primary ${
              compact ? 'text-xs' : 'text-sm tracking-tight'
            }`}
          >
            {title}
          </h4>
        )}
        {description && (
          <p className="text-[11px] text-muted leading-relaxed">{description}</p>
        )}
      </div>

      {action && <div className="pt-1">{action}</div>}
    </div>
  );
};

export interface ErrorBannerProps {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

/**
 * High-visibility banner for critical section failures, with an optional retry button.
 */
export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`p-3 rounded-[var(--radius-control)] bg-danger-soft border border-danger/30 flex items-start justify-between text-xs text-danger ${className}`}
    >
      <div className="flex items-start space-x-2.5 min-w-0 pr-2">
        <AlertCircle className="w-4 h-4 shrink-0 stroke-[2] mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-xs leading-tight">{title}</div>
          {message && (
            <div className="text-[11px] mt-0.5 text-danger/90 leading-relaxed break-words">
              {message}
            </div>
          )}
        </div>
      </div>

      {onRetry && (
        <Button
          variant="light"
          color="red"
          size="compact-xs"
          onClick={onRetry}
          className="shrink-0"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
};
