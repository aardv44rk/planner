import { Component, ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  name?: string;
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolates runtime rendering exceptions within a specific view or workspace.
 * Prevents whole-app blackouts and surfaces clean diagnostic recovery actions.
 */
export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[PageErrorBoundary:${this.props.name || 'Anonymous'}] Render error caught:`,
      error,
      errorInfo.componentStack
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl m-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
            <AlertCircle className="w-6 h-6 stroke-[2]" />
          </div>

          <div className="space-y-1.5 max-w-md">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {this.props.name ? `${this.props.name} encountered an unexpected error` : 'This view crashed while rendering'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-mono bg-[var(--bg-canvas)] p-3 rounded-lg border border-[var(--border-subtle)] text-left overflow-x-auto max-h-32">
              {this.state.error?.message || 'Unknown render exception'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--accent)] text-white hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset View</span>
            </button>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]/20 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
