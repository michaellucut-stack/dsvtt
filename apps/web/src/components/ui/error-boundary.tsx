'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Optional custom fallback UI. Receives the error and a reset function. */
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  /** Child components to render. */
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (process.env.NODE_ENV === 'development') {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center rounded-panel border border-crimson-700/40 bg-charcoal-900/80 px-6 py-12 text-center">
          {/* Shield-warning icon */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-crimson-950/40">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-crimson-400"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>

          <h3 className="font-heading text-lg font-semibold text-parchment-100">
            Something went wrong
          </h3>
          <p className="mt-2 max-w-sm text-sm text-parchment-400">
            An unexpected error occurred. You can try again, or refresh the page
            if the problem persists.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-4 max-w-lg overflow-auto rounded-card border border-charcoal-700 bg-charcoal-950 px-4 py-3 text-left text-xs text-crimson-300">
              {this.state.error.message}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleReset}
            className={[
              'mt-6 rounded-card border border-gold-600 bg-gold-600 px-5 py-2',
              'font-heading text-xs font-bold uppercase tracking-wider text-charcoal-950',
              'transition-all duration-150',
              'hover:bg-gold-500 hover:shadow-glow',
              'active:scale-95',
            ].join(' ')}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
